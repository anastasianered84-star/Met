// profile.js
const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

// Кэш для названий комнат
let roomsCache = {};

// Загрузка списка комнат для кэширования названий
async function loadRoomsCache() {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        
        if (data.success && data.rooms) {
            roomsCache = {};
            data.rooms.forEach(room => {
                roomsCache[room.id] = room.title;
            });
            console.log('Rooms cache loaded:', roomsCache);
        }
    } catch (error) {
        console.error('Error loading rooms cache:', error);
    }
}

// Получение названия комнаты по ID
function getRoomName(roomId) {
    return roomsCache[roomId] || `Комната #${roomId}`;
}

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    
    if (!token || !userId) {
        window.location.href = 'login.html';
        return;
    }
    
    // Загружаем кэш комнат
    await loadRoomsCache();
    
    await loadUserProfile();
    await loadUserBookings();
    loadFavoriteRooms();
});

// Загрузка профиля пользователя через эндпоинт /User/profile
async function loadUserProfile() {
    const token = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE_URL}/User/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.profile) {
            displayUserProfile(data.profile);
            // Сохраняем в localStorage для быстрого доступа
            localStorage.setItem('userFirstName', data.profile.first_name);
            localStorage.setItem('userLastName', data.profile.last_name);
            localStorage.setItem('userEmail', data.profile.email);
        } else {
            showNotification('Ошибка загрузки профиля', 'error');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

function displayUserProfile(profile) {
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    document.getElementById('userName').textContent = fullName || 'Пользователь';
    document.getElementById('userEmail').textContent = profile.email || '';
    document.getElementById('displayFirstName').textContent = profile.first_name || '';
    document.getElementById('displayLastName').textContent = profile.last_name || '';
    document.getElementById('displayEmail').textContent = profile.email || '';
    
    // Форматирование даты регистрации
    if (profile.created_at) {
        const date = new Date(profile.created_at);
        document.getElementById('displayCreatedAt').textContent = date.toLocaleDateString('ru-RU');
    } else {
        document.getElementById('displayCreatedAt').textContent = '—';
    }
    
    // Заполнение полей редактирования
    document.getElementById('editFirstName').value = profile.first_name || '';
    document.getElementById('editLastName').value = profile.last_name || '';
    document.getElementById('editEmail').value = profile.email || '';
}

// Загрузка бронирований пользователя через эндпоинт /User/bookings
async function loadUserBookings() {
    const token = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE_URL}/User/bookings`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.bookings) {
            updateBookingStats(data.bookings);
            displayRecentBookings(data.bookings);
        } else {
            console.log('No bookings found');
            displayRecentBookings([]);
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
        displayRecentBookings([]);
    }
}

// Обновление статистики
function updateBookingStats(bookings) {
    const now = new Date();
    
    let active = 0;
    let completed = 0;
    let upcoming = 0;
    
    bookings.forEach(booking => {
        const endTime = new Date(booking.end_time);
        const startTime = new Date(booking.start_time);
        
        if (booking.status === 'cancelled') {
            // Не считаем отмененные
        } else if (booking.status === 'active' || (startTime <= now && endTime > now)) {
            active++;
        } else if (booking.status === 'completed' || endTime < now) {
            completed++;
        } else if (booking.status === 'upcoming' || startTime > now) {
            upcoming++;
        }
    });
    
    document.getElementById('totalBookings').textContent = bookings.length;
    document.getElementById('activeBookings').textContent = active;
    document.getElementById('completedBookings').textContent = completed;
}

// Отображение последних бронирований с названиями комнат
function displayRecentBookings(bookings) {
    const container = document.getElementById('recentBookings');
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-calendar-xmark"></i>
                <p>У вас пока нет бронирований</p>
                <a href="catalog.html" class="btn btn-primary">Найти комнату</a>
            </div>
        `;
        return;
    }
    
    // Показываем только последние 3 бронирования (по дате начала)
    const recent = [...bookings].sort((a, b) => 
        new Date(b.start_time) - new Date(a.start_time)
    ).slice(0, 3);
    
    container.innerHTML = recent.map(booking => {
        const startTime = new Date(booking.start_time);
        const endTime = new Date(booking.end_time);
        const now = new Date();
        
        // Определяем статус
        let statusClass = '';
        let statusText = '';
        
        if (booking.status === 'cancelled') {
            statusClass = 'status-cancelled';
            statusText = 'Отменено';
        } else if (endTime < now) {
            statusClass = 'status-completed';
            statusText = 'Завершено';
        } else if (startTime <= now && endTime > now) {
            statusClass = 'status-active';
            statusText = 'Активно';
        } else if (startTime > now) {
            statusClass = 'status-upcoming';
            statusText = 'Предстоит';
        } else {
            statusClass = 'status-completed';
            statusText = 'Завершено';
        }
        
        // Получаем название комнаты
        const roomName = getRoomName(booking.room_id);
        
        // Длительность в часах
        const durationHours = Math.round((endTime - startTime) / (1000 * 60 * 60));
        
        return `
            <div class="booking-item" data-booking-id="${booking.id}">
                <div class="booking-item-header">
                    <span class="booking-item-title">
                        <i class="fa-solid fa-cube"></i> ${escapeHtml(roomName)}
                    </span>
                    <span class="booking-status ${statusClass}">${statusText}</span>
                </div>
                <div class="booking-item-details">
                    <div class="booking-item-info">
                        <i class="fa-solid fa-calendar"></i>
                        ${startTime.toLocaleDateString('ru-RU')}
                    </div>
                    <div class="booking-item-info">
                        <i class="fa-solid fa-clock"></i>
                        ${startTime.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})} - 
                        ${endTime.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div class="booking-item-info">
                        <i class="fa-solid fa-hourglass-half"></i>
                        ${durationHours} ч.
                    </div>
                    <div class="booking-item-info">
                        <i class="fa-solid fa-wallet"></i>
                        ${booking.total_price} ₽
                    </div>
                </div>
                <div class="booking-item-actions">
                    ${(statusClass === 'status-active' || statusClass === 'status-upcoming') && booking.status !== 'cancelled' ? `
                        <button class="btn btn-outline btn-sm" onclick="cancelBookingFromProfile(${booking.id})">
                            <i class="fa-solid fa-times"></i> Отменить
                        </button>
                    ` : ''}
                    ${statusClass === 'status-active' ? `
                        <a href="room.html?id=${booking.room_id}" class="btn btn-primary btn-sm">
                            <i class="fa-solid fa-play"></i> Войти
                        </a>
                    ` : ''}
                    ${statusClass === 'status-completed' ? `
                        <button class="btn btn-primary btn-sm" onclick="bookAgain(${booking.room_id})">
                            <i class="fa-solid fa-repeat"></i> Забронировать снова
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
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

// Отмена бронирования из профиля
async function cancelBookingFromProfile(bookingId) {
    if (!confirm('Вы уверены, что хотите отменить бронирование?')) return;
    
    const token = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE_URL}/User/bookings/${bookingId}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Бронирование отменено', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification(data.message || 'Ошибка при отмене', 'error');
        }
    } catch (error) {
        console.error('Cancel error:', error);
        showNotification('Ошибка при отмене бронирования', 'error');
    }
}

// Забронировать снова
function bookAgain(roomId) {
    window.location.href = `catalog.html?room=${roomId}`;
}

// Загрузка избранных комнат
async function loadFavoriteRooms() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const container = document.getElementById('favoriteRooms');
    
    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-heart"></i>
                <p>Нет избранных комнат</p>
                <a href="catalog.html" class="btn btn-primary">Добавить</a>
            </div>
        `;
        document.getElementById('favoriteCount').textContent = '0';
        return;
    }
    
    document.getElementById('favoriteCount').textContent = favorites.length;
    
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        
        if (data.success && data.rooms) {
            const favoriteRooms = data.rooms.filter(room => favorites.includes(room.id));
            
            if (favoriteRooms.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-regular fa-heart"></i>
                        <p>Нет избранных комнат</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = favoriteRooms.slice(0, 2).map(room => `
                <div class="favorite-item">
                    <img src="${getImageUrl(room.base_image_url)}" alt="${room.title}">
                    <div class="favorite-item-info">
                        <h4>${escapeHtml(room.title)}</h4>
                        <p>${room.price_per_hour}₽/час · до ${room.max_capacity} чел</p>
                        <button class="btn btn-outline btn-sm" onclick="viewRoomDetails(${room.id})">
                            Подробнее
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading favorite rooms:', error);
    }
}

function getImageUrl(path) {
    if (!path || path === 'qwe') return 'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=600';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return 'https://localhost:7255' + path;
    return 'https://localhost:7255/' + path;
}

// Просмотр деталей комнаты
function viewRoomDetails(roomId) {
    window.location.href = `room.html?id=${roomId}`;
}

// Переключение режима редактирования
function toggleEditMode() {
    document.getElementById('infoDisplay').style.display = 'none';
    document.getElementById('infoEdit').style.display = 'block';
    const editBtn = document.querySelector('.edit-profile-btn');
    if (editBtn) editBtn.style.display = 'none';
}

// Отмена редактирования
function cancelEdit() {
    document.getElementById('infoDisplay').style.display = 'block';
    document.getElementById('infoEdit').style.display = 'none';
    const editBtn = document.querySelector('.edit-profile-btn');
    if (editBtn) editBtn.style.display = 'block';
}

// Сохранение профиля (используем эндпоинт обновления, если есть)
async function saveProfile() {
    const token = localStorage.getItem('authToken');
    const firstName = document.getElementById('editFirstName').value;
    const lastName = document.getElementById('editLastName').value;
    const email = document.getElementById('editEmail').value;
    
    if (!firstName || !lastName || !email) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        // Пробуем обновить через API (если нет такого эндпоинта, обновляем локально)
        const formData = new FormData();
        formData.append('firstName', firstName);
        formData.append('lastName', lastName);
        formData.append('email', email);
        
        const response = await fetch(`${API_BASE_URL}/User/update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Обновляем отображение
                document.getElementById('displayFirstName').textContent = firstName;
                document.getElementById('displayLastName').textContent = lastName;
                document.getElementById('displayEmail').textContent = email;
                document.getElementById('userName').textContent = `${firstName} ${lastName}`;
                document.getElementById('userEmail').textContent = email;
                
                // Сохраняем в localStorage
                localStorage.setItem('userFirstName', firstName);
                localStorage.setItem('userLastName', lastName);
                localStorage.setItem('userEmail', email);
                
                showNotification('Профиль обновлен', 'success');
                cancelEdit();
            } else {
                showNotification(data.message || 'Ошибка при обновлении', 'error');
            }
        } else {
            // Если API нет, обновляем только локально
            document.getElementById('displayFirstName').textContent = firstName;
            document.getElementById('displayLastName').textContent = lastName;
            document.getElementById('displayEmail').textContent = email;
            document.getElementById('userName').textContent = `${firstName} ${lastName}`;
            document.getElementById('userEmail').textContent = email;
            
            localStorage.setItem('userFirstName', firstName);
            localStorage.setItem('userLastName', lastName);
            localStorage.setItem('userEmail', email);
            
            showNotification('Профиль обновлен локально', 'success');
            cancelEdit();
        }
    } catch (error) {
        console.error('Update error:', error);
        // Если API недоступен, обновляем локально
        document.getElementById('displayFirstName').textContent = firstName;
        document.getElementById('displayLastName').textContent = lastName;
        document.getElementById('displayEmail').textContent = email;
        document.getElementById('userName').textContent = `${firstName} ${lastName}`;
        document.getElementById('userEmail').textContent = email;
        
        localStorage.setItem('userFirstName', firstName);
        localStorage.setItem('userLastName', lastName);
        localStorage.setItem('userEmail', email);
        
        showNotification('Профиль обновлен', 'success');
        cancelEdit();
    }
}

// Смена пароля
async function changePassword() {
    const token = localStorage.getItem('authToken');
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Новые пароли не совпадают', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('currentPassword', currentPassword);
        formData.append('newPassword', newPassword);
        
        const response = await fetch(`${API_BASE_URL}/User/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Пароль успешно изменен', 'success');
            
            // Очищаем поля
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showNotification(data.message || 'Ошибка при смене пароля', 'error');
        }
    } catch (error) {
        console.error('Password change error:', error);
        showNotification('Ошибка при смене пароля', 'error');
    }
}
// Сохранение профиля
async function saveProfile() {
    const token = localStorage.getItem('authToken');
    const firstName = document.getElementById('editFirstName').value;
    const lastName = document.getElementById('editLastName').value;
    const email = document.getElementById('editEmail').value;
    
    if (!firstName || !lastName || !email) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Введите корректный email', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('firstName', firstName);
        formData.append('lastName', lastName);
        formData.append('email', email);
        
        const response = await fetch(`${API_BASE_URL}/User/update`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Обновляем отображение
            document.getElementById('displayFirstName').textContent = firstName;
            document.getElementById('displayLastName').textContent = lastName;
            document.getElementById('displayEmail').textContent = email;
            document.getElementById('userName').textContent = `${firstName} ${lastName}`;
            document.getElementById('userEmail').textContent = email;
            
            // Сохраняем в localStorage
            localStorage.setItem('userFirstName', firstName);
            localStorage.setItem('userLastName', lastName);
            localStorage.setItem('userEmail', email);
            
            showNotification('Профиль обновлен', 'success');
            cancelEdit();
        } else {
            showNotification(data.message || 'Ошибка при обновлении', 'error');
        }
    } catch (error) {
        console.error('Update error:', error);
        showNotification('Ошибка при обновлении профиля', 'error');
    }
}

// Смена пароля
async function changePassword() {
    const token = localStorage.getItem('authToken');
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Новые пароли не совпадают', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('currentPassword', currentPassword);
        formData.append('newPassword', newPassword);
        
        const response = await fetch(`${API_BASE_URL}/User/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Пароль успешно изменен', 'success');
            
            // Очищаем поля
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showNotification(data.message || 'Ошибка при смене пароля', 'error');
        }
    } catch (error) {
        console.error('Password change error:', error);
        showNotification('Ошибка при смене пароля', 'error');
    }
}

// Функция выхода
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userFirstName');
        localStorage.removeItem('userLastName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('favorites');
        showNotification('Вы вышли из системы', 'info');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1000);
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification`;
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
        top: 80px;
        right: 20px;
        padding: 12px 20px;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
        cursor: pointer;
    `;
    
    document.body.appendChild(notification);
    
    notification.onclick = () => notification.remove();
    
    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, 4000);
}

// Добавляем CSS
if (!document.querySelector('#profile-styles')) {
    const style = document.createElement('style');
    style.id = 'profile-styles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .booking-item {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        
        .booking-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        
        .booking-item-title {
            font-weight: 600;
            color: white;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .booking-item-details {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 0.75rem;
        }
        
        .booking-item-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: rgba(255,255,255,0.6);
            font-size: 0.85rem;
        }
        
        .booking-item-info i {
            width: 16px;
            color: #818cf8;
        }
        
        .booking-item-actions {
            display: flex;
            gap: 0.5rem;
            justify-content: flex-end;
        }
        
        .btn-sm {
            padding: 0.4rem 0.8rem;
            font-size: 0.8rem;
        }
        
        .status-cancelled {
            background: #ef4444;
            color: white;
            padding: 0.2rem 0.6rem;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 500;
        }
        
        .empty-state {
            text-align: center;
            padding: 2rem;
            color: rgba(255,255,255,0.5);
        }
        
        .empty-state i {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            display: block;
        }
    `;
    document.head.appendChild(style);
}