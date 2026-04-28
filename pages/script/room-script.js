const API_BASE_URL = 'https://localhost:7255/api';

let currentRoomId = null;
let lastChatMessageId = 0;
let pollingInterval = null;
let currentUserId = null;
let isRoomOwner = false;

document.addEventListener('DOMContentLoaded', async function () {
    const token = localStorage.getItem('authToken');
    currentUserId = parseInt(localStorage.getItem('userId'));

    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    const params = new URLSearchParams(window.location.search);
    currentRoomId = parseInt(params.get('id') || params.get('room'));

    if (!currentRoomId) {
        try {
            const res = await fetch(`${API_BASE_URL}/User/room`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.room) {
                currentRoomId = data.room.room_id;
            }
        } catch (e) {
            console.error('Не удалось получить активную комнату:', e);
        }
    }

    if (!currentRoomId) {
        showNotification('Комната не найдена', 'error');
        setTimeout(() => { window.location.href = 'catalog.html'; }, 2000);
        return;
    }

    // НЕ НУЖНО вызывать joinRoom - пользователь уже добавлен при бронировании
    // Просто загружаем информацию о комнате

    // Загрузить начальное состояние
    await refreshRoomInfo();
    await loadChatHistory();

    // Запустить polling каждые 5 секунд
    pollingInterval = setInterval(async () => {
        await refreshRoomInfo();
        await pollNewMessages();
    }, 5000);

    // Отправка сообщения по Enter
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Скрыть кнопку "Назад" в модале по умолчанию
    const backBtn = document.getElementById('backButton');
    if (backBtn) backBtn.style.display = 'none';

    // Скрыть методы приглашения по умолчанию
    document.querySelectorAll('.invite-method').forEach(el => {
        el.style.display = 'none';
    });
    
    // Обработчик закрытия модального окна
    window.onclick = function(event) {
        const modal = document.getElementById('inviteModal');
        if (event.target === modal) {
            closeModal('inviteModal');
        }
    };
    const inviteEmailInput = document.getElementById('inviteEmail');
if (inviteEmailInput) {
    inviteEmailInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            inviteUserByEmail();
        }
    });
}
});

// Функция joinRoom больше не нужна, но оставим на всякий случай (не используется)
async function joinRoom(roomId) {
    // Эта функция больше не вызывается
    console.log('joinRoom не используется - пользователь уже в комнате');
}

// ─────────────────────────────────────────
// Обновление информации о комнате (участники + таймер)
// ─────────────────────────────────────────
async function refreshRoomInfo() {
    const token = localStorage.getItem('authToken');
    if (!currentRoomId || !token) return;

    try {
        const url = `${API_BASE_URL}/Room/${currentRoomId}/info?userId=${currentUserId}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data.success) {
            console.error('Failed to get room info:', data);
            return;
        }

        const { room, participants } = data;
        
        // Определяем, является ли текущий пользователь владельцем
        if (participants && participants.length > 0) {
            const firstParticipant = participants[0];
            isRoomOwner = firstParticipant && firstParticipant.user_id === currentUserId;
        }

        // Показываем/скрываем кнопку "Пригласить" — только для создателя
        const inviteBtn = document.querySelector('.section-header .btn-primary');
        if (inviteBtn) {
            inviteBtn.style.display = isRoomOwner ? 'flex' : 'none';
        }

        // Обновляем заголовок участников
        const header = document.querySelector('.sidebar-section .section-header h3');
        if (header) {
            header.textContent = `Участники (${participants?.length || 0}/${room?.max_capacity || 0})`;
        }

        // Обновляем название комнаты в заголовке
        const roomTitleElement = document.querySelector('.room-title h1');
        if (roomTitleElement && room?.title) {
            roomTitleElement.textContent = room.title;
        }

        // Обновляем список участников (убираем дубликаты)
        if (participants) {
            // Убираем дубликаты по user_id
            const uniqueParticipants = [];
            const seenIds = new Set();
            for (const p of participants) {
                if (!seenIds.has(p.user_id)) {
                    seenIds.add(p.user_id);
                    uniqueParticipants.push(p);
                }
            }
            updateParticipantsList(uniqueParticipants);
        }

        // Обновляем информацию о комнате в боковой панели
        if (room) {
            updateRoomInfoPanel(room);
        }

        // Обновляем таймер
        if (room?.time_remaining_seconds !== null && room?.time_remaining_seconds !== undefined) {
            updateTimer(room.time_remaining_seconds);
        }

    } catch (e) {
        console.error('Ошибка обновления информации о комнате:', e);
    }
}

// ─────────────────────────────────────────
// Обновление списка участников
// ─────────────────────────────────────────
function updateParticipantsList(participants) {
    const usersList = document.querySelector('.users-list');
    if (!usersList) return;

    if (!participants || participants.length === 0) {
        usersList.innerHTML = `<p style="color: rgba(255,255,255,0.5); padding: 0.5rem;">Нет участников</p>`;
        return;
    }

    usersList.innerHTML = participants.map((p, index) => {
        const isHost = index === 0;
        const isCurrentUser = p.user_id === currentUserId;
        const statusClass = isCurrentUser ? 'speaking' : 'online';

        return `
            <div class="user-item ${isHost ? 'host' : ''}">
                <img src="../images/iconprofile.png" alt="Аватар" class="user-avatar">
                <div class="user-info">
                    <span class="user-name">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}${isCurrentUser ? ' (Вы)' : ''}</span>
                    <span class="user-role">${isHost ? 'Создатель' : 'Участник'}</span>
                </div>
                <div class="user-status ${statusClass}"></div>
            </div>
        `;
    }).join('');
}

// ─────────────────────────────────────────
// Обновление панели информации о комнате
// ─────────────────────────────────────────
function updateRoomInfoPanel(room) {
    // Обновляем информацию о вместимости
    const capacityElement = document.querySelector('.room-info .info-item:nth-child(2) span');
    if (capacityElement && room.max_capacity) {
        capacityElement.textContent = `Максимум: ${room.max_capacity} человек`;
    }
    
    // Обновляем ID комнаты
    const roomIdElement = document.querySelector('.room-info .info-item:nth-child(3) span');
    if (roomIdElement && room.id) {
        roomIdElement.textContent = `ID: ${room.id}`;
    }
}

// ─────────────────────────────────────────
// Таймер
// ─────────────────────────────────────────
function updateTimer(secondsRemaining) {
    const timerItem = document.querySelector('.room-info .info-item:first-child span');
    if (!timerItem) return;

    if (secondsRemaining <= 0) {
        timerItem.textContent = 'Время истекло';
        timerItem.style.color = '#ef4444';

        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        showNotification('Время бронирования истекло. Вы будете перенаправлены.', 'error');
        setTimeout(() => { window.location.href = 'catalog.html'; }, 4000);
        return;
    }

    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    const seconds = secondsRemaining % 60;

    let timeStr = '';
    if (hours > 0) timeStr += `${hours}ч `;
    timeStr += `${minutes}м ${seconds}с`;

    timerItem.textContent = `Осталось: ${timeStr}`;

    if (secondsRemaining < 300) {
        timerItem.style.color = '#ef4444';
    } else if (secondsRemaining < 900) {
        timerItem.style.color = '#f97316';
    } else {
        timerItem.style.color = '';
    }
}

// ─────────────────────────────────────────
// Загрузка истории чата
// ─────────────────────────────────────────
async function loadChatHistory() {
    const token = localStorage.getItem('authToken');
    if (!currentRoomId || !token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/Room/${currentRoomId}/chat`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!data.success) return;

        const container = document.querySelector('.chat-messages');
        if (!container) return;

        container.innerHTML = `
            <div class="message system">
                <div class="message-content">
                    <p>Вы вошли в комнату</p>
                </div>
                <span class="message-time">${formatTime(new Date())}</span>
            </div>
        `;

        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                msg.is_own = msg.user_id === currentUserId;
                appendChatMessage(msg, container);
            });
            lastChatMessageId = data.messages[data.messages.length - 1].id;
        }

        container.scrollTop = container.scrollHeight;

    } catch (e) {
        console.error('Ошибка загрузки чата:', e);
    }
}

// ─────────────────────────────────────────
// Polling новых сообщений
// ─────────────────────────────────────────
async function pollNewMessages() {
    const token = localStorage.getItem('authToken');
    if (!currentRoomId || !token) return;

    try {
        const res = await fetch(
            `${API_BASE_URL}/Room/${currentRoomId}/chat?afterId=${lastChatMessageId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await res.json();

        if (!data.success || !data.messages || !data.messages.length) return;

        const container = document.querySelector('.chat-messages');
        if (!container) return;

        data.messages.forEach(msg => {
            msg.is_own = msg.user_id === currentUserId;
            appendChatMessage(msg, container);
        });

        lastChatMessageId = data.messages[data.messages.length - 1].id;
        container.scrollTop = container.scrollHeight;

    } catch (e) {
        console.error('Ошибка polling чата:', e);
    }
}

// ─────────────────────────────────────────
// Отображение одного сообщения в чате
// ─────────────────────────────────────────
function appendChatMessage(msg, container) {
    const div = document.createElement('div');
    div.className = `message ${msg.is_own ? 'own' : ''}`;

    const timeStr = formatTime(new Date(msg.sent_at));

    if (msg.is_own) {
        div.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(msg.message)}</p>
            </div>
            <span class="message-time">${timeStr}</span>
        `;
    } else {
        div.innerHTML = `
            <img src="../images/iconprofile.png" alt="Аватар" class="message-avatar">
            <div class="message-content">
                <span class="message-author">${escapeHtml(msg.author_name)}</span>
                <p>${escapeHtml(msg.message)}</p>
            </div>
            <span class="message-time">${timeStr}</span>
        `;
    }

    container.appendChild(div);
}

// ─────────────────────────────────────────
// Отправка сообщения
// ─────────────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input?.value?.trim();
    if (!message) return;

    const token = localStorage.getItem('authToken');

    try {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('userId', currentUserId);

        const res = await fetch(`${API_BASE_URL}/Room/${currentRoomId}/chat/send`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();

        if (data.success) {
            input.value = '';

            const container = document.querySelector('.chat-messages');
            if (container) {
                appendChatMessage({
                    id: data.message_id,
                    message: message,
                    sent_at: data.sent_at || new Date().toISOString(),
                    is_own: true,
                    user_id: currentUserId,
                    author_name: 'Вы'
                }, container);
                container.scrollTop = container.scrollHeight;
                lastChatMessageId = data.message_id;
            }
        } else {
            showNotification(data.message || 'Ошибка отправки', 'error');
        }
    } catch (e) {
        console.error('Send message error:', e);
        showNotification('Ошибка отправки сообщения', 'error');
    }
}

// ─────────────────────────────────────────
// Выход из комнаты
// ─────────────────────────────────────────
async function leaveRoom() {
    if (!confirm('Вы уверены, что хотите покинуть комнату?')) return;

    const token = localStorage.getItem('authToken');

    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }

    try {
        const formData = new FormData();
        formData.append('roomId', currentRoomId);
        formData.append('userId', currentUserId);

        await fetch(`${API_BASE_URL}/Room/leave`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
    } catch (e) {
        console.error('Ошибка при выходе из комнаты:', e);
    }

    window.location.href = '../index.html';
}

// ─────────────────────────────────────────
// Модальное окно приглашения
// ─────────────────────────────────────────
function showInviteModal() {
    if (!isRoomOwner) {
        showNotification('Только создатель комнаты может приглашать участников', 'error');
        return;
    }
    const modal = document.getElementById('inviteModal');
    if (modal) {
        modal.style.display = 'flex';
        backToInviteMethods();
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.value = '';
        const searchResults = document.querySelector('.search-results');
        if (searchResults) searchResults.innerHTML = '';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function showInviteMethod(method) {
    document.querySelectorAll('.invite-method').forEach(el => {
        el.style.display = 'none';
    });
    const inviteOptions = document.querySelector('.invite-options');
    if (inviteOptions) inviteOptions.style.display = 'none';
    
    const methodElement = document.getElementById(method + 'Method');
    if (methodElement) methodElement.style.display = 'block';
    
    const backButton = document.getElementById('backButton');
    if (backButton) backButton.style.display = 'block';
    
    if (method === 'link') {
        updateInviteLink();
    }
    
    // Очищаем поле email при открытии
    if (method === 'email') {
        const emailInput = document.getElementById('inviteEmail');
        if (emailInput) emailInput.value = '';
        emailInput?.focus();
    }
}
function backToInviteMethods() {
    document.querySelectorAll('.invite-method').forEach(el => {
        el.style.display = 'none';
    });
    const inviteOptions = document.querySelector('.invite-options');
    if (inviteOptions) inviteOptions.style.display = 'grid';
    
    const backButton = document.getElementById('backButton');
    if (backButton) backButton.style.display = 'none';
}

function updateInviteLink() {
    const linkInput = document.getElementById('inviteLink');
    if (linkInput) {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?id=${currentRoomId}&invite=1`;
        linkInput.value = inviteUrl;
    }
}

function copyInviteLink() {
    const input = document.getElementById('inviteLink');
    if (input) {
        input.select();
        document.execCommand('copy');
        showNotification('Ссылка скопирована!', 'success');
    }
}

async function searchUsers(query) {
    const token = localStorage.getItem('authToken');
    if (!currentRoomId || !token || !isRoomOwner) return;

    if (query.length < 2) {
        const container = document.querySelector('.search-results');
        if (container) container.innerHTML = '';
        return;
    }

    try {
        const res = await fetch(
            `${API_BASE_URL}/Room/${currentRoomId}/search-users?query=${encodeURIComponent(query)}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await res.json();

        const container = document.querySelector('.search-results');
        if (!container) return;

        if (!data.success || !data.users || !data.users.length) {
            container.innerHTML = `<p style="color:rgba(255,255,255,0.5); padding:0.5rem;">Пользователи не найдены</p>`;
            return;
        }

        container.innerHTML = data.users.map(u => {
            const alreadyThere = u.is_already_in_room;
            const label = alreadyThere ? 'В комнате' : 'Пригласить';
            return `
                <div class="search-result">
                    <img src="../images/iconprofile.png" alt="User">
                    <div class="search-result-info">
                        <span class="search-result-name">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</span>
                        <span class="search-result-status">${escapeHtml(u.email)}</span>
                    </div>
                    <button class="invite-btn" onclick="inviteUser(${u.user_id})" ${alreadyThere ? 'disabled style="opacity:0.5"' : ''}>
                        ${label}
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Ошибка поиска пользователей:', e);
    }
}

async function inviteUser(invitedUserId) {
    const token = localStorage.getItem('authToken');
    if (!isRoomOwner) {
        showNotification('Только создатель может приглашать участников', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('roomId', currentRoomId);
        formData.append('invitedUserId', invitedUserId);

        const res = await fetch(`${API_BASE_URL}/Room/invite`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            showNotification(data.message, 'success');
            const searchInput = document.querySelector('.search-input');
            if (searchInput && searchInput.value) {
                await searchUsers(searchInput.value);
            }
            await refreshRoomInfo();
        } else {
            showNotification(data.message || 'Ошибка при приглашении', 'error');
        }
    } catch (e) {
        console.error('Invite error:', e);
        showNotification('Ошибка при приглашении', 'error');
    }
}

function toggleChat() {
    const chat = document.querySelector('.chat-sidebar');
    if (chat) {
        chat.classList.toggle('open');
    }
}

// ─────────────────────────────────────────
// Вспомогательные функции
// ─────────────────────────────────────────
function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.room-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'room-notification';
    notification.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: slideIn 0.3s ease;
        cursor: pointer;
    `;

    document.body.appendChild(notification);
    
    notification.onclick = () => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };

    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Добавляем стили для анимаций
if (!document.querySelector('#room-styles')) {
    const style = document.createElement('style');
    style.id = 'room-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0);   opacity: 1; }
            to   { transform: translateX(100%); opacity: 0; }
        }
        .room-notification {
            font-family: inherit;
        }
    `;
    document.head.appendChild(style);
}
async function inviteUserByEmail() {
    const token = localStorage.getItem('authToken');
    if (!isRoomOwner) {
        showNotification('Только создатель может приглашать участников', 'error');
        return;
    }

    const emailInput = document.getElementById('inviteEmail');
    const email = emailInput?.value?.trim();
    
    if (!email) {
        showNotification('Введите email пользователя', 'error');
        return;
    }
    
    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Введите корректный email адрес', 'error');
        return;
    }

    // Показываем индикатор загрузки
    const inviteBtn = document.querySelector('#emailMethod .btn-primary');
    const originalText = inviteBtn?.innerHTML;
    if (inviteBtn) {
        inviteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Отправка...';
        inviteBtn.disabled = true;
    }

    try {
        // Сначала ищем пользователя по email через existing API
        const searchResponse = await fetch(
            `${API_BASE_URL}/Room/${currentRoomId}/search-users?query=${encodeURIComponent(email)}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const searchData = await searchResponse.json();
        
        let invitedUserId = null;
        
        // Если пользователь найден по email
        if (searchData.success && searchData.users && searchData.users.length > 0) {
            // Ищем точное совпадение email
            const exactMatch = searchData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (exactMatch) {
                invitedUserId = exactMatch.user_id;
                
                // Проверяем, не в комнате ли уже пользователь
                if (exactMatch.is_already_in_room) {
                    showNotification('Пользователь уже в комнате', 'warning');
                    return;
                }
            }
        }
        
        if (invitedUserId) {
            // Пользователь найден, приглашаем через существующий метод
            const formData = new FormData();
            formData.append('roomId', currentRoomId);
            formData.append('invitedUserId', invitedUserId);
            
            const inviteResponse = await fetch(`${API_BASE_URL}/Room/invite`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            const inviteData = await inviteResponse.json();
            
            if (inviteData.success) {
                showNotification(`Приглашение отправлено на ${email}`, 'success');
                if (emailInput) emailInput.value = '';
                closeModal('inviteModal');
                await refreshRoomInfo();
            } else {
                showNotification(inviteData.message || 'Ошибка при приглашении', 'error');
            }
        } else {
            // Пользователь не найден в системе, отправляем приглашение на email через бэкенд
            // Используем специальный endpoint для приглашения по email (если он есть на бэкенде)
            const formData = new FormData();
            formData.append('roomId', currentRoomId);
            formData.append('email', email);
            formData.append('inviterUserId', currentUserId);
            
            // Пробуем новый endpoint, если его нет - показываем сообщение
            try {
                const emailInviteResponse = await fetch(`${API_BASE_URL}/Room/invite-by-email`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                
                const emailInviteData = await emailInviteResponse.json();
                
                if (emailInviteResponse.ok && emailInviteData.success) {
                    showNotification(emailInviteData.message, 'success');
                    if (emailInput) emailInput.value = '';
                    closeModal('inviteModal');
                } else {
                    showNotification('Пользователь с таким email не зарегистрирован в системе. Приглашение не может быть отправлено.', 'error');
                }
            } catch (emailEndpointError) {
                // Если endpoint не существует
                showNotification('Пользователь с таким email не зарегистрирован в системе. Приглашение не может быть отправлено.', 'error');
            }
        }
    } catch (error) {
        console.error('Invite by email error:', error);
        showNotification('Ошибка при отправке приглашения', 'error');
    } finally {
        if (inviteBtn) {
            inviteBtn.innerHTML = originalText;
            inviteBtn.disabled = false;
        }
    }
}