const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

let currentRoomId = null;
let currentRoomName = null;
let currentRoomPrice = null;
let currentRoomCapacity = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let bookedSlots = {};
let selectedDate = null;
let selectedHour = null;
let pendingBooking = null;

const urlParams = new URLSearchParams(window.location.search);
const roomIdFromUrl = urlParams.get('id');

document.addEventListener('DOMContentLoaded', async function() {
    if (!roomIdFromUrl) {
        alert('Комната не указана');
        window.location.href = 'catalog.html';
        return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Необходимо войти в систему');
        window.location.href = 'login.html';
        return;
    }

    await loadRoomInfo(roomIdFromUrl);
    await loadCalendar(currentRoomId, currentYear, currentMonth);

    document.getElementById('prevMonthBtn').onclick = () => {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        loadCalendar(currentRoomId, currentYear, currentMonth);
    };

    document.getElementById('nextMonthBtn').onclick = () => {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        loadCalendar(currentRoomId, currentYear, currentMonth);
    };

    document.getElementById('duration').addEventListener('change', calculatePrice);
    document.getElementById('bookingForm').addEventListener('submit', handleBookingSubmit);
});

async function loadRoomInfo(roomId) {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        const room = data.rooms.find(r => r.id == roomId);
        
        if (room) {
            currentRoomId = room.id;
            currentRoomName = room.title;
            currentRoomPrice = room.price_per_hour;
            currentRoomCapacity = room.max_capacity;
            
            document.getElementById('roomTitle').textContent = `Бронирование: ${room.title}`;
            document.getElementById('roomName').textContent = room.title;
            document.getElementById('roomCapacity').textContent = room.max_capacity;
            document.getElementById('roomPrice').textContent = room.price_per_hour;
            document.getElementById('roomId').value = room.id;
            document.getElementById('participants').max = room.max_capacity;
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Ошибка загрузки комнаты', 'error');
    }
}

async function loadCalendar(roomId, year, month) {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/${roomId}/booked-slots?year=${year}&month=${month}`);
        const data = await response.json();
        if (data.success) {
            bookedSlots = data.bookedSlots;
            renderCalendar(year, month);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderCalendar(year, month) {
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.querySelector('.calendar-header h2').innerHTML = `<i class="fa-regular fa-calendar"></i> ${monthNames[month-1]} ${year}`;
    
    const firstDay = new Date(year, month-1, 1);
    const lastDay = new Date(year, month, 0);
    let startOffset = firstDay.getDay();
    startOffset = startOffset === 0 ? 7 : startOffset;
    
    const daysContainer = document.getElementById('calendarDays');
    daysContainer.innerHTML = '';
    
    for (let i = 1; i < startOffset; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day';
        empty.style.opacity = '0';
        daysContainer.appendChild(empty);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const cellDate = new Date(year, month-1, d);
        const isPast = cellDate < today;
        const dateKey = cellDate.toISOString().split('T')[0];
        const dayBookings = bookedSlots[dateKey] || [];
        
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        if (isPast) {
            dayCell.classList.add('booked');
        } else if (dayBookings.length === 0) {
            dayCell.classList.add('free');
        } else {
            // Проверяем, полностью ли занят день (24 часа)
            const bookedHours = new Set();
            dayBookings.forEach(b => {
                for (let h = b.startHour; h < b.endHour; h++) {
                    bookedHours.add(h);
                }
            });
            // Всего 24 часа в сутках
            if (bookedHours.size >= 24) {
                dayCell.classList.add('booked');
            } else {
                dayCell.classList.add('partial');
            }
        }
        
        dayCell.innerHTML = `<span class="day-number">${d}</span><div class="status-dot"></div>`;
        dayCell.onclick = () => !isPast && onDateSelect(cellDate);
        daysContainer.appendChild(dayCell);
    }
}

async function onDateSelect(date) {
    selectedDate = date;
    document.getElementById('selectedDateInfo').textContent = date.toLocaleDateString('ru-RU');
    
    document.querySelectorAll('.calendar-day').forEach(cell => cell.classList.remove('selected'));
    if (event && event.target) {
        event.target.classList.add('selected');
    }
    
    await loadAvailableHours(currentRoomId, date);
}

async function loadAvailableHours(roomId, date) {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const response = await fetch(`${API_BASE_URL}/Room/${roomId}/available-hours?date=${dateStr}`);
        const data = await response.json();
        if (data.success) {
            // Передаем оба массива: свободные часы И занятые часы
            displayTimeSlots(data.availableHours, data.bookedHours);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function displayTimeSlots(availableHours, bookedHours) {
    const container = document.getElementById('timeSlotsGrid');
    if (!container) return;
    
    // Создаем массив всех часов от 0 до 23 (круглосуточно)
    const allHours = [];
    for (let hour = 0; hour < 24; hour++) {
        allHours.push(hour);
    }
    
    // Создаем Set занятых часов для быстрой проверки
    const bookedSet = new Set(bookedHours || []);
    const availableSet = new Set(availableHours || []);
    
    container.innerHTML = '';
    
    allHours.forEach(hour => {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        
        // Форматируем время
        const startTimeStr = `${hour.toString().padStart(2, '0')}:00`;
        const endTimeStr = `${(hour + 1).toString().padStart(2, '0')}:00`;
        slot.textContent = `${startTimeStr} - ${endTimeStr}`;
        
        // Проверяем, занят ли этот час
        if (bookedSet.has(hour)) {
            slot.classList.add('booked-time');
            slot.title = 'Это время уже занято';
            slot.onclick = null;
        } else {
            slot.classList.add('available');
            slot.onclick = () => onTimeSlotSelect(hour, slot);
        }
        
        container.appendChild(slot);
    });
}

function onTimeSlotSelect(hour, slotElement) {
    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected-slot'));
    slotElement.classList.add('selected-slot');
    selectedHour = hour;
    
    if (selectedDate && selectedHour !== null) {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        document.getElementById('bookingDate').value = `${year}-${month}-${day}`;
        document.getElementById('startTime').value = `${String(selectedHour).padStart(2, '0')}:00`;
        calculatePrice();
    }
}

function calculatePrice() {
    const duration = parseInt(document.getElementById('duration').value);
    const total = duration * currentRoomPrice;
    document.getElementById('totalPrice').textContent = total + ' ₽';
}

async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const date = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('startTime').value;
    const duration = parseInt(document.getElementById('duration').value);
    const participants = parseInt(document.getElementById('participants').value);
    const specialRequests = document.getElementById('specialRequests').value;
    
    if (!date || !startTime) {
        showNotification('Выберите дату и время', 'error');
        return;
    }
    
    if (participants > currentRoomCapacity) {
        showNotification(`Максимум участников: ${currentRoomCapacity}`, 'error');
        return;
    }
    
    const startDateTime = new Date(`${date}T${startTime}`);
    const now = new Date();
    
    if (startDateTime < now) {
        showNotification('Нельзя забронировать время в прошлом', 'error');
        return;
    }
    
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    const formData = new FormData();
    formData.append('roomId', currentRoomId);
    formData.append('userId', userId);
    formData.append('startTime', startDateTime.toISOString());
    formData.append('endTime', endDateTime.toISOString());
    formData.append('specialRequests', specialRequests);
    
    try {
        const response = await fetch(`${API_BASE_URL}/Room/book`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Бронирование успешно создано!', 'success');
            setTimeout(() => {
                window.location.href = 'booking.html';
            }, 1500);
        } else {
            showNotification('❌ Ошибка: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Ошибка при бронировании', 'error');
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
    notification.style.cssText = `
        position: fixed; top: 80px; right: 20px; padding: 12px 20px;
        background: ${colors[type] || colors.info}; color: white;
        border-radius: 8px; z-index: 10000; animation: fadeIn 0.3s ease;
    `;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}