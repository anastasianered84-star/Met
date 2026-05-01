const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

// Формирует корректный URL картинки
function getImageUrl(path) {
    if (!path || path === 'qwe') return 'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=600';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return API_HOST + path;
    return API_HOST + '/' + path;
}

// Переменные для хранения данных бронирования перед оплатой
let pendingBooking = null;

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    notification.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        padding: '12px 20px',
        background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6',
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: '500',
        animation: 'slideInRight 0.3s ease',
        cursor: 'pointer'
    });
    
    document.body.appendChild(notification);
    
    notification.onclick = () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Добавляем CSS анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Получение текущего пользователя
function getCurrentUser() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) return null;
    return { token, userId: parseInt(userId) };
}

// Проверка авторизации
function isAuthenticated() {
    return localStorage.getItem('authToken') !== null && localStorage.getItem('userId') !== null;
}

// Открытие модального окна бронирования
function openBookingModal(roomName, maxParticipants = 8, roomId = null, pricePerHour = 350) {
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему для бронирования', 'error');
        setTimeout(() => {
            window.location.href = 'pages/login.html';
        }, 1500);
        return;
    }
    
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    
    document.getElementById('roomName').value = roomName;
    document.getElementById('participants').max = maxParticipants;
    document.getElementById('participants').value = 1;
    modal.style.display = 'flex';
    
    modal.dataset.pricePerHour = pricePerHour;
    modal.dataset.roomId = roomId;
    modal.dataset.roomName = roomName;
    modal.dataset.maxParticipants = maxParticipants;
    
    const today = new Date();
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        dateInput.min = today.toISOString().split('T')[0];
        dateInput.valueAsDate = today;
    }
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    const timeInput = document.getElementById('startTime');
    if (timeInput) {
        timeInput.value = nextHour.toTimeString().slice(0, 5);
    }
    
    document.getElementById('specialRequests').value = '';
    calculatePrice();
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function calculatePrice() {
    const duration = parseInt(document.getElementById('duration')?.value || 1);
    const pricePerHour = parseFloat(document.getElementById('bookingModal')?.dataset.pricePerHour || 350);
    const total = duration * pricePerHour;
    
    const priceSpan = document.getElementById('bookingPrice');
    if (priceSpan) {
        priceSpan.textContent = total + '₽';
    }
}

// Открытие модального окна оплаты
function openPaymentModal(bookingData) {
    pendingBooking = bookingData;
    
    document.getElementById('paymentRoomName').textContent = bookingData.roomName;
    document.getElementById('paymentDateTime').textContent = bookingData.dateTime;
    document.getElementById('paymentDuration').textContent = bookingData.duration + ' ' + getHoursWord(bookingData.duration);
    document.getElementById('paymentAmount').textContent = bookingData.totalPrice + ' ₽';
    
    document.getElementById('paymentModal').style.display = 'flex';
    
    const cardRadio = document.querySelector('input[value="card"]');
    const sbpRadio = document.querySelector('input[value="sbp"]');
    const balanceRadio = document.querySelector('input[value="balance"]');
    const cardForm = document.getElementById('cardForm');
    const sbpForm = document.getElementById('sbpForm');
    
    const handleMethodChange = () => {
        if (cardRadio.checked) {
            cardForm.style.display = 'block';
            sbpForm.style.display = 'none';
        } else if (sbpRadio.checked) {
            cardForm.style.display = 'none';
            sbpForm.style.display = 'block';
        } else {
            cardForm.style.display = 'none';
            sbpForm.style.display = 'none';
        }
    };
    
    cardRadio.addEventListener('change', handleMethodChange);
    sbpRadio.addEventListener('change', handleMethodChange);
    balanceRadio.addEventListener('change', handleMethodChange);
    handleMethodChange();
    
    // Форматирование номера карты
    const cardNumber = document.getElementById('cardNumber');
    cardNumber.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
        e.target.value = value.substring(0, 19);
    });
    
    const cardExpiry = document.getElementById('cardExpiry');
    cardExpiry.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value.substring(0, 5);
    });
    
    const cardCvv = document.getElementById('cardCvv');
    cardCvv.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
    });
    
    const phoneNumber = document.getElementById('phoneNumber');
    phoneNumber.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 0) {
            let formatted = '+7';
            if (value.length > 1) formatted += ' (' + value.substring(1, 4);
            if (value.length >= 4) formatted += ') ' + value.substring(4, 7);
            if (value.length >= 7) formatted += '-' + value.substring(7, 9);
            if (value.length >= 9) formatted += '-' + value.substring(9, 11);
            e.target.value = formatted;
        }
    });
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    pendingBooking = null;
}

// Имитация обработки платежа
async function processPayment() {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    if (paymentMethod === 'card') {
        const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const cardExpiry = document.getElementById('cardExpiry').value;
        const cardCvv = document.getElementById('cardCvv').value;
        
        if (cardNumber.length !== 16) {
            showNotification('Введите корректный номер карты (16 цифр)', 'error');
            return;
        }
        if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
            showNotification('Введите корректный срок действия (MM/YY)', 'error');
            return;
        }
        if (cardCvv.length !== 3) {
            showNotification('Введите корректный CVV код (3 цифры)', 'error');
            return;
        }
    }
    
    if (paymentMethod === 'sbp') {
        const phone = document.getElementById('phoneNumber').value;
        if (!phone.match(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/)) {
            showNotification('Введите корректный номер телефона', 'error');
            return;
        }
    }
    
    const payButton = document.getElementById('payButton');
    const paymentLoader = document.getElementById('paymentLoader');
    const paymentDetails = document.getElementById('paymentDetails');
    
    payButton.style.display = 'none';
    paymentDetails.style.display = 'none';
    paymentLoader.style.display = 'block';
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const isSuccess = Math.random() < 0.95;
    
    if (isSuccess) {
        await completeBooking();
    } else {
        paymentLoader.style.display = 'none';
        paymentDetails.style.display = 'block';
        payButton.style.display = 'block';
        showNotification('Ошибка оплаты. Попробуйте другую карту.', 'error');
    }
}

// Завершение бронирования после успешной оплаты
async function completeBooking() {
    if (!pendingBooking) {
        showNotification('Ошибка: данные бронирования не найдены', 'error');
        closePaymentModal();
        return;
    }
    
    const user = getCurrentUser();
    if (!user) {
        showNotification('Необходимо войти в систему', 'error');
        closePaymentModal();
        setTimeout(() => {
            window.location.href = 'pages/login.html';
        }, 1500);
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('roomId', pendingBooking.roomId);
        formData.append('userId', user.userId);
        formData.append('startTime', pendingBooking.startDateTime.toISOString());
        formData.append('endTime', pendingBooking.endDateTime.toISOString());
        formData.append('specialRequests', `Количество участников: ${pendingBooking.participants}. ${pendingBooking.specialRequests || ''}`);
        
        const response = await fetch(`${API_BASE_URL}/Room/book`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${user.token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const paymentLoader = document.getElementById('paymentLoader');
            paymentLoader.innerHTML = `
                <i class="fa-solid fa-check-circle" style="font-size: 48px; color: #10b981; margin-bottom: 15px;"></i>
                <p style="color: #10b981;">Оплата прошла успешно!</p>
                <p style="color: rgba(255,255,255,0.7); font-size: 14px;">Перенаправление...</p>
            `;
            
            savePaymentToHistory({
                id: data.booking_id,
                roomName: pendingBooking.roomName,
                amount: pendingBooking.totalPrice,
                date: new Date().toISOString(),
                status: 'success'
            });
            
            setTimeout(() => {
                closePaymentModal();
                showNotification(`✅ Комната "${pendingBooking.roomName}" успешно забронирована!`, 'success');
                
                setTimeout(() => {
                    if (confirm('Перейти в забронированную комнату?')) {
                        window.location.href = `pages/room.html?id=${pendingBooking.roomId}`;
                    }
                }, 500);
            }, 2000);
        } else {
            throw new Error(data.message || 'Ошибка при бронировании');
        }
    } catch (error) {
        console.error('Booking error:', error);
        
        const paymentLoader = document.getElementById('paymentLoader');
        paymentLoader.innerHTML = `
            <i class="fa-solid fa-exclamation-circle" style="font-size: 48px; color: #ef4444; margin-bottom: 15px;"></i>
            <p style="color: #ef4444;">Ошибка бронирования!</p>
            <p style="color: rgba(255,255,255,0.7); font-size: 14px;">${error.message}</p>
        `;
        
        setTimeout(() => {
            closePaymentModal();
            showNotification(error.message, 'error');
        }, 2000);
    }
}

function savePaymentToHistory(payment) {
    let history = JSON.parse(localStorage.getItem('paymentHistory') || '[]');
    history.unshift(payment);
    if (history.length > 20) history.pop();
    localStorage.setItem('paymentHistory', JSON.stringify(history));
}

function getHoursWord(hours) {
    if (hours === 1) return 'час';
    if (hours >= 2 && hours <= 4) return 'часа';
    return 'часов';
}

// Обработчик формы бронирования
document.getElementById('bookingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        showNotification('Необходимо войти в систему', 'error');
        setTimeout(() => {
            window.location.href = 'pages/login.html';
        }, 1500);
        return;
    }
    
    const modal = document.getElementById('bookingModal');
    const roomId = modal.dataset.roomId;
    const roomName = modal.dataset.roomName;
    const pricePerHour = parseFloat(modal.dataset.pricePerHour);
    
    if (!roomId) {
        showNotification('Ошибка: комната не выбрана', 'error');
        return;
    }
    
    const date = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('startTime').value;
    const duration = parseInt(document.getElementById('duration').value);
    const participants = parseInt(document.getElementById('participants').value);
    const specialRequests = document.getElementById('specialRequests')?.value || '';
    const totalPrice = duration * pricePerHour;
    const maxParticipants = parseInt(modal.dataset.maxParticipants);
    
    if (!date || !startTime) {
        showNotification('Заполните дату и время', 'error');
        return;
    }
    
    if (participants > maxParticipants) {
        showNotification(`Максимальное количество участников: ${maxParticipants}`, 'error');
        return;
    }
    
    const startDateTime = new Date(`${date}T${startTime}`);
    const now = new Date();
    
    if (startDateTime < now) {
        showNotification('Нельзя забронировать время в прошлом', 'error');
        return;
    }
    
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    const dateTimeStr = startDateTime.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const bookingData = {
        roomId: roomId,
        roomName: roomName,
        dateTime: dateTimeStr,
        duration: duration,
        participants: participants,
        specialRequests: specialRequests,
        totalPrice: totalPrice,
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        pricePerHour: pricePerHour
    };
    
    closeBookingModal();
    openPaymentModal(bookingData);
});

// Загрузка и отображение комнат
async function loadRooms() {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        
        if (data.success && data.rooms) {
            displayRooms(data.rooms);
        } else {
            showNotification('Ошибка загрузки комнат', 'error');
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        showNotification('Ошибка загрузки комнат: ' + error.message, 'error');
    }
}

function displayRooms(rooms) {
    const roomsGrid = document.querySelector('.rooms-grid');
    if (!roomsGrid) return;
    
    roomsGrid.innerHTML = rooms.map(room => `
        <div class="room-card" data-room-id="${room.id}">
            <div class="room-image">
                <img src="${getImageUrl(room.base_image_url)}" alt="${room.title}">
                <div class="room-badge">${room.price_per_hour === 0 ? 'Бесплатно' : 'Популярное'}</div>
                <button class="favorite-btn" onclick="toggleFavorite(${room.id})">
                    <i class="fa-regular fa-heart"></i>
                </button>
            </div>
            <div class="room-content">
                <h3 class="room-title">${escapeHtml(room.title)}</h3>
                <p class="room-description">${escapeHtml(room.description || 'Нет описания')}</p>
                <div class="room-meta">
                    <div class="room-capacity"><i class="fa-solid fa-user"></i> до ${room.max_capacity} человек</div>
                    <div class="room-price">${room.price_per_hour}₽/час</div>
                </div>
                <div class="room-features">
                    <span class="feature-tag"><i class="fa-solid fa-wifi"></i> VR Ready</span>
                    <span class="feature-tag"><i class="fa-solid fa-microphone"></i> Голосовой чат</span>
                </div>
                <div class="room-actions">
                    <button class="btn btn-primary" onclick="openBookingModal('${escapeHtml(room.title)}', ${room.max_capacity}, ${room.id}, ${room.price_per_hour})">
                        <i class="fa-regular fa-calendar-check"></i> Забронировать
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function viewRoomDetails(roomId) {
    window.location.href = `pages/room.html?id=${roomId}`;
}

// Избранное
function toggleFavorite(roomId) {
    const button = event.currentTarget;
    const icon = button.querySelector('i');
    const isFavorite = icon.classList.contains('fa-solid');
    
    if (!isFavorite) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        button.style.color = '#ef4444';
        saveFavorite(roomId);
        showNotification('Добавлено в избранное', 'success');
    } else {
        icon.classList.remove('fa-solid');
        icon.classList.add('fa-regular');
        button.style.color = '';
        removeFavorite(roomId);
        showNotification('Удалено из избранного', 'info');
    }
}

function saveFavorite(roomId) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (!favorites.includes(roomId)) {
        favorites.push(roomId);
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }
}

function removeFavorite(roomId) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favorites = favorites.filter(id => id !== roomId);
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Поиск
function searchRooms(searchTerm) {
    const searchLower = searchTerm.toLowerCase().trim();
    const roomCards = document.querySelectorAll('.room-card');
    let visibleCount = 0;
    
    roomCards.forEach(card => {
        const title = card.querySelector('.room-title')?.textContent.toLowerCase() || '';
        const description = card.querySelector('.room-description')?.textContent.toLowerCase() || '';
        const shouldShow = !searchTerm || title.includes(searchLower) || description.includes(searchLower);
        card.style.display = shouldShow ? 'flex' : 'none';
        if (shouldShow) visibleCount++;
    });
    
    const noResultsMsg = document.getElementById('noResultsMessage');
    if (visibleCount === 0 && searchTerm) {
        if (!noResultsMsg) {
            const msg = document.createElement('div');
            msg.id = 'noResultsMessage';
            msg.style.cssText = 'text-align: center; padding: 40px; color: rgba(255,255,255,0.5);';
            msg.innerHTML = '<i class="fa-solid fa-search" style="font-size: 48px; margin-bottom: 16px;"></i><h3>Ничего не найдено</h3><p>Попробуйте изменить параметры поиска</p>';
            document.querySelector('.rooms-grid').appendChild(msg);
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    if (document.querySelector('.rooms-grid')) {
        await loadRooms();
    }
    
    const searchInput = document.querySelector('.search-bar input');
    const searchButton = document.querySelector('.search-bar button');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchRooms(e.target.value);
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            const input = document.querySelector('.search-bar input');
            if (input) searchRooms(input.value);
        });
    }
    
    const durationSelect = document.getElementById('duration');
    if (durationSelect) {
        durationSelect.addEventListener('change', calculatePrice);
    }
    
    window.onclick = function(event) {
        const modal = document.getElementById('bookingModal');
        if (event.target === modal) closeBookingModal();
        const paymentModal = document.getElementById('paymentModal');
        if (event.target === paymentModal) closePaymentModal();
    };
    
    const user = getCurrentUser();
    const userActions = document.querySelector('.user-actions');
    
    if (user && userActions) {
        try {
            const response = await fetch(`${API_BASE_URL}/User/${user.userId}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const data = await response.json();
            if (data.success && data.user) {
                userActions.innerHTML = `
                    <div class="user-menu" style="display: flex; gap: 10px; align-items: center;">
                        <span style="color: white;"><i class="fa-solid fa-user"></i> ${data.user.first_name} ${data.user.last_name}</span>
                        <button class="btn btn-outline" onclick="logout()">
                            <i class="fa-solid fa-sign-out-alt"></i> Выйти
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }
    
    console.log('MetaBook VR Room Booking Portal initialized');
});

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    showNotification('Вы вышли из системы', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}