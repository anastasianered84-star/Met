const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

function getImageUrl(path) {
    if (!path || path === 'qwe') return 'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=600';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return API_HOST + path;
    return API_HOST + '/' + path;
}

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

// Переменные для хранения данных бронирования перед оплатой
let pendingBooking = null;

document.addEventListener('DOMContentLoaded', async function() {
    await loadRooms();
    
    // Настройка фильтрации по цене
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        const priceValue = document.getElementById('priceValue');
        priceRange.addEventListener('input', function() {
            priceValue.textContent = this.value + '₽';
            filterRooms();
        });
    }
    
    // Настройка отображения (сетка/список)
    const gridViewBtn = document.getElementById('gridView');
    const listViewBtn = document.getElementById('listView');
    const roomsContainer = document.getElementById('roomsContainer');
    
    if (gridViewBtn && listViewBtn && roomsContainer) {
        gridViewBtn.addEventListener('click', function() {
            roomsContainer.classList.remove('list-view');
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
        });
        
        listViewBtn.addEventListener('click', function() {
            roomsContainer.classList.add('list-view');
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
        });
    }

    // Фильтры по вместимости
    const capacityOptions = document.querySelectorAll('.capacity-option');
    capacityOptions.forEach(option => {
        option.addEventListener('click', function() {
            capacityOptions.forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            filterRooms();
        });
    });
    
    // Сброс фильтров
    const filterReset = document.querySelector('.filter-reset');
    if (filterReset) {
        filterReset.addEventListener('click', resetFilters);
    }
    
    // Поиск
    const searchInput = document.querySelector('.search-box input');
    const searchButton = document.querySelector('.search-box button');
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                filterRooms();
            }
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            filterRooms();
        });
    }
    
    // Обработчик формы бронирования
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', handleBookingSubmit);
    }
    
    // Закрытие модальных окон при клике вне их
    window.onclick = function(event) {
        const modal = document.getElementById('bookingModal');
        if (event.target === modal) {
            closeBookingModal();
        }
        const paymentModal = document.getElementById('paymentModal');
        if (event.target === paymentModal) {
            closePaymentModal();
        }
    }
    
    // Устанавливаем минимальную дату в календаре
    const bookingDate = document.getElementById('bookingDate');
    if (bookingDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        bookingDate.min = today.toISOString().split('T')[0];
    }
    
    // Пересчет цены при изменении длительности
    const durationSelect = document.getElementById('duration');
    if (durationSelect) {
        durationSelect.addEventListener('change', calculatePrice);
    }
    
    // Добавляем CSS для анимации спиннера
    if (!document.querySelector('#payment-styles')) {
        const style = document.createElement('style');
        style.id = 'payment-styles';
        style.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
});

let allRooms = [];

async function loadRooms() {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        
        if (data.success && data.rooms) {
            allRooms = data.rooms;
            displayRooms(allRooms);
            updateResultsCount(allRooms.length);
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        showNotification('Ошибка загрузки комнат', 'error');
    }
}

function displayRooms(rooms) {
    const roomsContainer = document.getElementById('roomsContainer');
    if (!roomsContainer) return;
    
    if (rooms.length === 0) {
        roomsContainer.innerHTML = `
            <div class="no-results">
                <i class="fa-solid fa-search"></i>
                <h3>Комнаты не найдены</h3>
                <p>Попробуйте изменить параметры фильтрации</p>
            </div>
        `;
        return;
    }
    
    roomsContainer.innerHTML = rooms.map(room => `
        <div class="room-card" data-room-id="${room.id}" data-price="${room.price_per_hour}" data-capacity="${room.max_capacity}" data-title="${room.title.replace(/'/g, "\\'")}">
            <div class="room-image">
                <img src="${getImageUrl(room.base_image_url)}" alt="${room.title}">
                <div class="room-badge ${room.price_per_hour === 0 ? 'free' : 'popular'}">${room.price_per_hour === 0 ? 'Бесплатно' : 'Популярное'}</div>
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
    
    loadFavorites();
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

// Функции бронирования
function openBookingModal(roomName, maxParticipants, roomId, pricePerHour) {
    // Проверка авторизации
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему для бронирования', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }
    
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    
    // Заполняем данные
    document.getElementById('roomName').value = roomName;
    document.getElementById('participants').max = maxParticipants;
    document.getElementById('participants').value = 1;
    
    // Сохраняем данные комнаты в dataset
    modal.dataset.roomId = roomId;
    modal.dataset.roomName = roomName;
    modal.dataset.pricePerHour = pricePerHour;
    modal.dataset.maxParticipants = maxParticipants;
    
    // Устанавливаем дату по умолчанию - завтра
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        dateInput.valueAsDate = tomorrow;
    }
    
    // Устанавливаем время начала по умолчанию - следующий час
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    const timeInput = document.getElementById('startTime');
    if (timeInput) {
        timeInput.value = nextHour.toTimeString().slice(0, 5);
    }
    
    // Сбрасываем особые пожелания
    const specialRequests = document.getElementById('specialRequests');
    if (specialRequests) {
        specialRequests.value = '';
    }
    
    // Пересчитываем цену
    calculatePrice();
    
    // Показываем модальное окно
    modal.style.display = 'flex';
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function calculatePrice() {
    const duration = parseInt(document.getElementById('duration')?.value || 1);
    const pricePerHour = parseFloat(document.getElementById('bookingModal')?.dataset.pricePerHour || 0);
    const total = duration * pricePerHour;
    
    const priceSpan = document.getElementById('bookingPrice');
    if (priceSpan) {
        priceSpan.textContent = total + '₽';
    }
}

// Открытие модального окна оплаты
function openPaymentModal(bookingData) {
    pendingBooking = bookingData;
    
    // Заполняем данные
    document.getElementById('paymentRoomName').textContent = bookingData.roomName;
    document.getElementById('paymentDateTime').textContent = bookingData.dateTime;
    document.getElementById('paymentDuration').textContent = bookingData.duration + ' ' + getHoursWord(bookingData.duration);
    document.getElementById('paymentAmount').textContent = bookingData.totalPrice + ' ₽';
    
    // Показываем модальное окно
    document.getElementById('paymentModal').style.display = 'flex';
    
    // Обработчики переключения методов оплаты
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
    
    // Форматирование срока действия
    const cardExpiry = document.getElementById('cardExpiry');
    cardExpiry.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value.substring(0, 5);
    });
    
    // Только цифры для CVV
    const cardCvv = document.getElementById('cardCvv');
    cardCvv.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
    });
    
    // Форматирование телефона
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
    
    // Валидация в зависимости от метода оплаты
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
    
    // Показываем лоадер
    const payButton = document.getElementById('payButton');
    const paymentLoader = document.getElementById('paymentLoader');
    const paymentDetails = document.getElementById('paymentDetails');
    
    payButton.style.display = 'none';
    paymentDetails.style.display = 'none';
    paymentLoader.style.display = 'block';
    
    // Имитация задержки обработки платежа (1-2 секунды)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Имитация успешной оплаты (95% успеха)
    const isSuccess = Math.random() < 0.95;
    
    if (isSuccess) {
        // Успешная оплата - отправляем бронирование на сервер
        await completeBooking();
    } else {
        // Ошибка оплаты
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
            window.location.href = 'login.html';
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
            // Скрываем лоадер и показываем успех
            const paymentLoader = document.getElementById('paymentLoader');
            paymentLoader.innerHTML = `
                <i class="fa-solid fa-check-circle" style="font-size: 48px; color: #10b981; margin-bottom: 15px;"></i>
                <p style="color: #10b981;">Оплата прошла успешно!</p>
                <p style="color: rgba(255,255,255,0.7); font-size: 14px;">Перенаправление...</p>
            `;
            
            // Сохраняем в историю платежей (localStorage)
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
                        window.location.href = `room.html?id=${pendingBooking.roomId}`;
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

// Сохранение истории платежей
function savePaymentToHistory(payment) {
    let history = JSON.parse(localStorage.getItem('paymentHistory') || '[]');
    history.unshift(payment);
    if (history.length > 20) history.pop();
    localStorage.setItem('paymentHistory', JSON.stringify(history));
}

// Вспомогательная функция для склонения часов
function getHoursWord(hours) {
    if (hours === 1) return 'час';
    if (hours >= 2 && hours <= 4) return 'часа';
    return 'часов';
}

// Обработчик формы бронирования - собирает данные и открывает окно оплаты
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) {
        showNotification('Необходимо войти в систему', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
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
    
    // Валидация
    if (!date) {
        showNotification('Выберите дату', 'error');
        return;
    }
    
    if (!startTime) {
        showNotification('Выберите время начала', 'error');
        return;
    }
    
    if (participants > maxParticipants) {
        showNotification(`Максимальное количество участников: ${maxParticipants}`, 'error');
        return;
    }
    
    // Формируем дату и время
    const startDateTime = new Date(`${date}T${startTime}`);
    const now = new Date();
    
    if (startDateTime < now) {
        showNotification('Нельзя забронировать время в прошлом', 'error');
        return;
    }
    
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    // Форматируем дату для отображения
    const dateTimeStr = startDateTime.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Сохраняем данные бронирования для оплаты
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
    
    // Закрываем модальное окно бронирования
    closeBookingModal();
    
    // Открываем модальное окно оплаты
    openPaymentModal(bookingData);
}

// Фильтрация комнат
function filterRooms() {
    let filteredRooms = [...allRooms];
    
    // Фильтр по цене
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        const maxPrice = parseInt(priceRange.value);
        filteredRooms = filteredRooms.filter(room => room.price_per_hour <= maxPrice);
    }
    
    // Фильтр по вместимости
    const activeCapacity = document.querySelector('.capacity-option.active');
    if (activeCapacity) {
        const capacityText = activeCapacity.textContent;
        if (capacityText.includes('до 4')) {
            filteredRooms = filteredRooms.filter(room => room.max_capacity <= 4);
        } else if (capacityText.includes('5-10')) {
            filteredRooms = filteredRooms.filter(room => room.max_capacity >= 5 && room.max_capacity <= 10);
        } else if (capacityText.includes('10+')) {
            filteredRooms = filteredRooms.filter(room => room.max_capacity > 10);
        }
    }
    
    // Поиск по названию и описанию
    const searchInput = document.querySelector('.search-box input');
    if (searchInput && searchInput.value) {
        const searchTerm = searchInput.value.toLowerCase();
        filteredRooms = filteredRooms.filter(room => 
            room.title.toLowerCase().includes(searchTerm) || 
            (room.description && room.description.toLowerCase().includes(searchTerm))
        );
    }
    
    displayRooms(filteredRooms);
    updateResultsCount(filteredRooms.length);
}

function resetFilters() {
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        priceRange.value = 1000;
        document.getElementById('priceValue').textContent = '1000₽';
    }
    
    document.querySelectorAll('.capacity-option').forEach(option => {
        if (option.textContent.includes('5-10')) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    displayRooms(allRooms);
    updateResultsCount(allRooms.length);
}

function updateResultsCount(count) {
    const resultsCount = document.querySelector('.results-count');
    if (resultsCount) {
        const word = getDeclension(count, 'комната', 'комнаты', 'комнат');
        resultsCount.textContent = `Найдено: ${count} ${word}`;
    }
}

function getDeclension(number, one, two, five) {
    let n = Math.abs(number);
    n %= 100;
    if (n >= 5 && n <= 20) return five;
    n %= 10;
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return two;
    return five;
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

function loadFavorites() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const roomCard = btn.closest('.room-card');
        if (roomCard) {
            const roomId = parseInt(roomCard.dataset.roomId);
            if (favorites.includes(roomId)) {
                const icon = btn.querySelector('i');
                icon.classList.remove('fa-regular');
                icon.classList.add('fa-solid');
                btn.style.color = '#ef4444';
            }
        }
    });
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
    
    notification.onclick = () => {
        notification.remove();
    };
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 4000);
}

// Добавляем CSS анимации
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .no-results {
            text-align: center;
            padding: 3rem;
            color: var(--light);
            grid-column: 1 / -1;
        }
        
        .no-results i {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: #818cf8;
        }
    `;
    document.head.appendChild(style);
}