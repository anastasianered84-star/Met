// Auth functionality
const API_BASE_URL = 'https://localhost:7255/api';

let currentEmail = '';
let verificationTimer = null;
let timerSeconds = 0;

document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    
    await updateAuthUI(token, userId);
    
    // Password strength indicator
    const passwordInput = document.getElementById('regPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', checkPasswordStrength);
    }
    
    // Отправка кода
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', sendVerificationCode);
    }
    
    // Регистрация
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function sendVerificationCode() {
    const email = document.getElementById('regEmail').value;
    
    if (!email || !email.includes('@')) {
        showNotification('Введите корректный email', 'error');
        return;
    }
    
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const originalText = sendCodeBtn.innerHTML;
    
    try {
        sendCodeBtn.disabled = true;
        sendCodeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Отправка...';
        
        const formData = new URLSearchParams();
        formData.append('email', email);
        
        const response = await fetch(`${API_BASE_URL}/Auth/send-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentEmail = email;
            showNotification('Код подтверждения отправлен на email', 'success');
            
            // Показываем скрытые поля
            document.getElementById('codeGroup').style.display = 'block';
            document.getElementById('passwordGroup').style.display = 'block';
            document.getElementById('confirmGroup').style.display = 'block';
            document.getElementById('formOptions').style.display = 'block';
            document.getElementById('authDivider').style.display = 'block';
            document.getElementById('socialAuth').style.display = 'block';
            document.getElementById('registerBtn').style.display = 'block';
            
            // Меняем текст кнопки
            sendCodeBtn.style.display = 'none';
            
            // Запускаем таймер
            startTimer(600); // 10 минут = 600 секунд
        } else {
            showNotification(data.message || 'Ошибка отправки кода', 'error');
        }
    } catch (error) {
        console.error('Send code error:', error);
        showNotification('Ошибка отправки кода', 'error');
    } finally {
        sendCodeBtn.disabled = false;
        sendCodeBtn.innerHTML = originalText;
    }
}

function startTimer(seconds) {
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;
    
    timerSeconds = seconds;
    timerElement.style.display = 'block';
    
    if (verificationTimer) clearInterval(verificationTimer);
    
    verificationTimer = setInterval(() => {
        const minutes = Math.floor(timerSeconds / 60);
        const secs = timerSeconds % 60;
        timerElement.textContent = `Код действителен: ${minutes}:${secs.toString().padStart(2, '0')}`;
        
        if (timerSeconds <= 0) {
            clearInterval(verificationTimer);
            timerElement.innerHTML = '<span style="color: #ef4444;">Код истёк. Запросите новый.</span>';
            
            // Блокируем регистрацию
            const registerBtn = document.getElementById('registerBtn');
            if (registerBtn) registerBtn.disabled = true;
            
            // Показываем кнопку повторной отправки
            const sendCodeBtn = document.getElementById('sendCodeBtn');
            sendCodeBtn.style.display = 'block';
            sendCodeBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Отправить код снова';
        }
        timerSeconds--;
    }, 1000);
}

async function handleRegister(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName')?.value;
    const lastName = document.getElementById('lastName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const code = document.getElementById('verificationCode')?.value;
    const agreeTerms = document.getElementById('agreeTerms')?.checked;
    
    if (!firstName || !lastName) {
        showNotification('Введите имя и фамилию', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Пароли не совпадают!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    if (!code) {
        showNotification('Введите код подтверждения', 'error');
        return;
    }
    
    if (!agreeTerms) {
        showNotification('Примите условия использования', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('registerBtn');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Регистрация...';
        
        const formData = new URLSearchParams();
        formData.append('firstName', firstName);
        formData.append('lastName', lastName);
        formData.append('email', email);
        formData.append('password', password);
        formData.append('code', code);
        
        const response = await fetch(`${API_BASE_URL}/Auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Сохраняем данные пользователя
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userId', data.user_id);
            localStorage.setItem('userFirstName', data.first_name);
            localStorage.setItem('userLastName', data.last_name);
            localStorage.setItem('userEmail', data.email);
            
            showNotification('Регистрация выполнена успешно!', 'success');
            
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
        } else {
            throw new Error(data.message || 'Ошибка регистрации');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Вход...';
        
        const formData = new URLSearchParams();
        formData.append('email', email);
        formData.append('password', password);
        
        const response = await fetch(`${API_BASE_URL}/Auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userId', data.user_id);
            localStorage.setItem('userFirstName', data.first_name);
            localStorage.setItem('userLastName', data.last_name);
            localStorage.setItem('userEmail', data.email);
            
            showNotification('Вход выполнен успешно!', 'success');
            
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
        } else {
            throw new Error(data.message || 'Неверный email или пароль');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function checkPasswordStrength() {
    const password = document.getElementById('regPassword')?.value || '';
    const strengthBar = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    let text = '';
    let color = '';
    
    if (password.length >= 8) strength += 20;
    if (password.match(/[a-z]+/)) strength += 20;
    if (password.match(/[A-Z]+/)) strength += 20;
    if (password.match(/[0-9]+/)) strength += 20;
    if (password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/)) strength += 20;
    
    if (strength <= 20) {
        text = 'Очень слабый';
        color = '#ef4444';
    } else if (strength <= 40) {
        text = 'Слабый';
        color = '#f97316';
    } else if (strength <= 60) {
        text = 'Средний';
        color = '#eab308';
    } else if (strength <= 80) {
        text = 'Сильный';
        color = '#84cc16';
    } else {
        text = 'Очень сильный';
        color = '#10b981';
    }
    
    strengthBar.style.width = strength + '%';
    strengthBar.style.backgroundColor = color;
    strengthText.textContent = 'Надёжность пароля: ' + text;
    strengthText.style.color = color;
}

async function updateAuthUI(token, userId) {
    const userActions = document.querySelector('.user-actions');
    if (!userActions) return;
    
    const isInPages = window.location.pathname.includes('/pages/');
    const prefix = isInPages ? '../' : '';
    
    if (token && userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/User/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.success && data.profile) {
                userActions.innerHTML = `
                    <div class="user-profile-mini">
                        <span class="user-name"><i class="fa-solid fa-user"></i> ${data.profile.first_name} ${data.profile.last_name}</span>
                    </div>
                    <button class="btn btn-outline" onclick="location.href='${prefix}pages/profile.html'">
                        <i class="fa-solid fa-id-card"></i> Профиль
                    </button>
                    <button class="btn btn-primary" onclick="logout()">
                        <i class="fa-solid fa-right-from-bracket"></i> Выйти
                    </button>
                `;
            } else {
                userActions.innerHTML = `
                    <button class="btn btn-outline" onclick="location.href='${prefix}pages/profile.html'">
                        <i class="fa-solid fa-user"></i> Профиль
                    </button>
                    <button class="btn btn-primary" onclick="logout()">
                        <i class="fa-solid fa-right-from-bracket"></i> Выйти
                    </button>
                `;
            }
        } catch (error) {
            userActions.innerHTML = `
                <button class="btn btn-outline" onclick="location.href='${prefix}pages/profile.html'">
                    <i class="fa-solid fa-user"></i> Профиль
                </button>
                <button class="btn btn-primary" onclick="logout()">
                    <i class="fa-solid fa-right-from-bracket"></i> Выйти
                </button>
            `;
        }
    } else {
        userActions.innerHTML = `
            <button class="btn btn-outline" onclick="location.href='${prefix}pages/login.html'">
                <i class="fa-solid fa-user"></i> Войти
            </button>
            <button class="btn btn-primary" onclick="location.href='${prefix}pages/register.html'">
                <i class="fa-solid fa-user-plus"></i> Регистрация
            </button>
        `;
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userLastName');
    localStorage.removeItem('userEmail');
    showNotification('Вы вышли из системы', 'info');
    setTimeout(() => {
        window.location.href = '../index.html';
    }, 1000);
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    notification.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: slideIn 0.3s ease;
        cursor: pointer;
    `;
    
    document.body.appendChild(notification);
    
    notification.onclick = () => notification.remove();
    
    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, 4000);
}

// Добавляем стили
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .user-profile-mini {
        display: flex;
        align-items: center;
        margin-right: 1rem;
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .user-profile-mini .user-name {
        color: #818cf8;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
`;
document.head.appendChild(style);