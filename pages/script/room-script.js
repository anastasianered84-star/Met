const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

let currentRoomId = null;
let currentUserId = null;
let isRoomOwner = false;
let connection = null;

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

    // Загружаем информацию о комнате
    await refreshRoomInfo();
    
    // ========== ПОДКЛЮЧАЕМ SIGNALR ДЛЯ ЧАТА ==========
    await initSignalR();

    // Отправка сообщения по Enter
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Скрыть кнопку "Назад" в модале по ум-default
    const backBtn = document.getElementById('backButton');
    if (backBtn) backBtn.style.display = 'none';

    // Скрыть методы приглашения по умолчанию
    document.querySelectorAll('.invite-method').forEach(el => {
        el.style.display = 'none';
    });
    
    window.onclick = function(event) {
        const modal = document.getElementById('inviteModal');
        if (event.target === modal) {
            closeModal('inviteModal');
        }
    };
});

// ========== SIGNALR ==========
async function initSignalR() {
    if (connection) return;
    
    try {
        // Проверяем, что signalR загружен
        if (typeof signalR === 'undefined') {
            console.error('SignalR библиотека не загружена');
            showNotification('Ошибка загрузки чата, обновите страницу', 'error');
            return;
        }
        
        connection = new signalR.HubConnectionBuilder()
            .withUrl(`${API_HOST}/chatHub`)
            .withAutomaticReconnect()
            .build();

        connection.on("ReceiveMessage", (message) => {
            const container = document.querySelector('.chat-messages');
            if (!container) return;
            
            const msg = {
                ...message,
                is_own: message.user_id === currentUserId
            };
            
            // Удаляем системное сообщение "Вы вошли в комнату", если оно есть
            if (container.querySelector('.message.system')) {
                container.innerHTML = '';
            }
            
            appendChatMessage(msg, container);
            container.scrollTop = container.scrollHeight;
        });

        await connection.start();
        console.log('SignalR connected');
        
        await connection.invoke("JoinRoom", currentRoomId, currentUserId);
        console.log('Joined room:', currentRoomId);
        
        // Добавляем системное сообщение о входе
        const container = document.querySelector('.chat-messages');
        if (container) {
            container.innerHTML = `
                <div class="message system">
                    <div class="message-content">
                        <p>Вы вошли в комнату</p>
                    </div>
                    <span class="message-time">${formatTime(new Date())}</span>
                </div>
            `;
        }
        
    } catch (err) {
        console.error('SignalR connection error:', err);
        showNotification('Ошибка подключения чата. Проверьте соединение.', 'error');
    }
}

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
        
        if (participants && participants.length > 0) {
            const firstParticipant = participants[0];
            isRoomOwner = firstParticipant && firstParticipant.user_id === currentUserId;
        }

        const inviteBtn = document.querySelector('.section-header .btn-primary');
        if (inviteBtn) {
            inviteBtn.style.display = isRoomOwner ? 'flex' : 'none';
        }

        const header = document.querySelector('.sidebar-section .section-header h3');
        if (header) {
            header.textContent = `Участники (${participants?.length || 0}/${room?.max_capacity || 0})`;
        }

        const roomTitleElement = document.querySelector('.room-title h1');
        if (roomTitleElement && room?.title) {
            roomTitleElement.textContent = room.title;
        }

        if (participants) {
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

        if (room) {
            updateRoomInfoPanel(room);
        }

        if (room?.time_remaining_seconds !== null && room?.time_remaining_seconds !== undefined) {
            updateTimer(room.time_remaining_seconds);
        }

    } catch (e) {
        console.error('Ошибка обновления информации о комнате:', e);
    }
}

// ========== ОТПРАВКА СООБЩЕНИЯ ЧЕРЕЗ SIGNALR ==========
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input?.value?.trim();
    if (!message) return;

    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
        showNotification('Чат не подключён', 'error');
        return;
    }

    try {
        await connection.invoke("SendMessage", currentRoomId, message, currentUserId);
        input.value = '';
    } catch (e) {
        console.error('Send error:', e);
        showNotification('Ошибка отправки сообщения', 'error');
    }
}
const headerName = document.getElementById('headerUserName');
if (headerName) {
    const firstName = localStorage.getItem('userFirstName') || '';
    headerName.textContent = firstName;
}
// ========== ОСТАЛЬНЫЕ ФУНКЦИИ ==========

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

function updateRoomInfoPanel(room) {
    const capacityElement = document.querySelector('.room-info .info-item:nth-child(2) span');
    if (capacityElement && room.max_capacity) {
        capacityElement.textContent = `Максимум: ${room.max_capacity} человек`;
    }
    
    const roomIdElement = document.querySelector('.room-info .info-item:nth-child(3) span');
    if (roomIdElement && room.id) {
        roomIdElement.textContent = `ID: ${room.id}`;
    }
}

function updateTimer(secondsRemaining) {
    const timerItem = document.querySelector('.room-info .info-item:first-child span');
    if (!timerItem) return;

    if (secondsRemaining <= 0) {
        timerItem.textContent = 'Время истекло';
        timerItem.style.color = '#ef4444';

        if (connection) {
            connection.stop();
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

async function leaveRoom() {
    if (!confirm('Вы уверены, что хотите покинуть комнату?')) return;

    const token = localStorage.getItem('authToken');

    if (connection) {
        try {
            await connection.invoke("LeaveRoom", currentRoomId);
            await connection.stop();
        } catch (e) {
            console.error('Error leaving SignalR room:', e);
        }
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
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Введите корректный email адрес', 'error');
        return;
    }

    const inviteBtn = document.querySelector('#emailMethod .btn-primary');
    const originalText = inviteBtn?.innerHTML;
    if (inviteBtn) {
        inviteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Отправка...';
        inviteBtn.disabled = true;
    }

    try {
        const searchResponse = await fetch(
            `${API_BASE_URL}/Room/${currentRoomId}/search-users?query=${encodeURIComponent(email)}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const searchData = await searchResponse.json();
        
        let invitedUserId = null;
        
        if (searchData.success && searchData.users && searchData.users.length > 0) {
            const exactMatch = searchData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (exactMatch) {
                invitedUserId = exactMatch.user_id;
                
                if (exactMatch.is_already_in_room) {
                    showNotification('Пользователь уже в комнате', 'warning');
                    return;
                }
            }
        }
        
        if (invitedUserId) {
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
            const formData = new FormData();
            formData.append('roomId', currentRoomId);
            formData.append('email', email);
            formData.append('inviterUserId', currentUserId);
            
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

function toggleChat() {
    const chat = document.querySelector('.chat-sidebar');
    if (chat) {
        chat.classList.toggle('open');
    }
}

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