// auth-check.js - простой скрипт для проверки авторизации на всех страницах

// Выполняется сразу после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
});

function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const userActions = document.querySelector('.user-actions');
    
    if (!userActions) return;
    
    // Определяем путь для кнопок
    const isInPages = window.location.pathname.includes('/pages/');
    
    if (token && userId) {
        // Пользователь авторизован - показываем кнопку "Выйти"
        userActions.innerHTML = `
            <button class="btn btn-outline" onclick="window.location.href='${isInPages ? 'profile.html' : 'pages/profile.html'}'">
                <i class="fa-solid fa-user"></i> Профиль
            </button>
            <button class="btn btn-primary" onclick="logout()">
                <i class="fa-solid fa-right-from-bracket"></i> Выйти
            </button>
        `;
    } else {
        // Пользователь не авторизован - показываем кнопки "Войти" и "Регистрация"
        userActions.innerHTML = `
            <button class="btn btn-outline" onclick="window.location.href='${isInPages ? 'login.html' : 'pages/login.html'}'">
                <i class="fa-solid fa-user"></i> Войти
            </button>
            <button class="btn btn-primary" onclick="window.location.href='${isInPages ? 'register.html' : 'pages/register.html'}'">
                <i class="fa-solid fa-user-plus"></i> Регистрация
            </button>
        `;
    }
}

// Функция выхода
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    alert('Вы вышли из системы');
    window.location.href = '../index.html';
}