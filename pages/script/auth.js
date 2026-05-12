// Auth functionality
const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

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
    
    // Валидация полей в реальном времени
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('regEmail');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (firstNameInput) {
        firstNameInput.addEventListener('input', () => validateField(firstNameInput, 'firstNameError'));
    }
    if (lastNameInput) {
        lastNameInput.addEventListener('input', () => validateField(lastNameInput, 'lastNameError'));
    }
    if (emailInput) {
        emailInput.addEventListener('input', () => validateField(emailInput, 'emailError'));
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', () => validateField(passwordInput, 'passwordError'));
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => validatePasswordMatch());
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

// Валидация отдельного поля
function validateField(input, errorId) {
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    if (input.id === 'firstName') {
        if (!value) {
            isValid = false;
            errorMessage = 'Введите имя';
        } else if (value.length < 2) {
            isValid = false;
            errorMessage = 'Имя должно содержать минимум 2 символа';
        } else if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(value)) {
            isValid = false;
            errorMessage = 'Имя может содержать только буквы';
        }
    }
    
    if (input.id === 'lastName') {
        if (!value) {
            isValid = false;
            errorMessage = 'Введите фамилию';
        } else if (value.length < 2) {
            isValid = false;
            errorMessage = 'Фамилия должна содержать минимум 2 символа';
        } else if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(value)) {
            isValid = false;
            errorMessage = 'Фамилия может содержать только буквы';
        }
    }
    
    if (input.id === 'regEmail') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
            isValid = false;
            errorMessage = 'Введите email';
        } else if (!emailRegex.test(value)) {
            isValid = false;
            errorMessage = 'Введите корректный email';
        }
    }
    
    if (input.id === 'regPassword') {
        if (!value) {
            isValid = false;
            errorMessage = 'Введите пароль';
        } else if (value.length < 6) {
            isValid = false;
            errorMessage = 'Пароль должен быть не менее 6 символов';
        }
    }
    
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        if (!isValid) {
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
            input.style.borderColor = '#ef4444';
        } else {
            errorElement.style.display = 'none';
            input.style.borderColor = '#10b981';
        }
    }
    
    return isValid;
}

// Проверка совпадения паролей
function validatePasswordMatch() {
    const password = document.getElementById('regPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    const errorElement = document.getElementById('confirmError');
    
    if (!confirmPassword) {
        if (errorElement) {
            errorElement.textContent = 'Подтвердите пароль';
            errorElement.style.display = 'block';
        }
        return false;
    }
    
    if (password !== confirmPassword) {
        if (errorElement) {
            errorElement.textContent = 'Пароли не совпадают';
            errorElement.style.display = 'block';
        }
        document.getElementById('confirmPassword').style.borderColor = '#ef4444';
        return false;
    } else {
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        document.getElementById('confirmPassword').style.borderColor = '#10b981';
        return true;
    }
}

// Полная валидация формы регистрации
function validateRegistrationForm() {
    const firstName = document.getElementById('firstName')?.value.trim();
    const lastName = document.getElementById('lastName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const code = document.getElementById('verificationCode')?.value.trim();
    const agreeTerms = document.getElementById('agreeTerms')?.checked;
    
    let isValid = true;
    const errors = [];
    
    // Имя
    if (!firstName) {
        errors.push('Введите имя');
        isValid = false;
    } else if (firstName.length < 2) {
        errors.push('Имя должно содержать минимум 2 символа');
        isValid = false;
    }
    
    // Фамилия
    if (!lastName) {
        errors.push('Введите фамилию');
        isValid = false;
    } else if (lastName.length < 2) {
        errors.push('Фамилия должна содержать минимум 2 символа');
        isValid = false;
    }
    
    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        errors.push('Введите email');
        isValid = false;
    } else if (!emailRegex.test(email)) {
        errors.push('Введите корректный email');
        isValid = false;
    }
    
    // Пароль
    if (!password) {
        errors.push('Введите пароль');
        isValid = false;
    } else if (password.length < 6) {
        errors.push('Пароль должен быть не менее 6 символов');
        isValid = false;
    }
    
    // Подтверждение пароля
    if (password !== confirmPassword) {
        errors.push('Пароли не совпадают');
        isValid = false;
    }
    
    // Код подтверждения
    if (!code) {
        errors.push('Введите код подтверждения');
        isValid = false;
    } else if (!/^\d{6}$/.test(code)) {
        errors.push('Код должен состоять из 6 цифр');
        isValid = false;
    }
    
    // Согласие с условиями
    if (!agreeTerms) {
        errors.push('Примите условия использования');
        isValid = false;
    }
    
    if (!isValid) {
        showNotification(errors[0], 'error');
    }
    
    return isValid;
}

// Полная валидация формы логина
function validateLoginForm() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    
    if (!email) {
        showNotification('Введите email', 'error');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Введите корректный email', 'error');
        return false;
    }
    
    if (!password) {
        showNotification('Введите пароль', 'error');
        return false;
    }
    
    return true;
}

async function sendVerificationCode() {
    const email = document.getElementById('regEmail').value.trim();
    
    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        showNotification('Введите email', 'error');
        return;
    }
    if (!emailRegex.test(email)) {
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
            const codeGroup = document.getElementById('codeGroup');
            const passwordGroup = document.getElementById('passwordGroup');
            const confirmGroup = document.getElementById('confirmGroup');
            const formOptions = document.getElementById('formOptions');
            const registerBtn = document.getElementById('registerBtn');
            
            if (codeGroup) codeGroup.style.display = 'block';
            if (passwordGroup) passwordGroup.style.display = 'block';
            if (confirmGroup) confirmGroup.style.display = 'block';
            if (formOptions) formOptions.style.display = 'block';
            if (registerBtn) registerBtn.style.display = 'block';
            
            // Меняем текст кнопки
            sendCodeBtn.style.display = 'none';
            
            // Запускаем таймер
            startTimer(600);
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
            
            const registerBtn = document.getElementById('registerBtn');
            if (registerBtn) registerBtn.disabled = true;
            
            const sendCodeBtn = document.getElementById('sendCodeBtn');
            sendCodeBtn.style.display = 'block';
            sendCodeBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Отправить код снова';
        }
        timerSeconds--;
    }, 1000);
}

async function handleRegister(e) {
    e.preventDefault();
    
    if (!validateRegistrationForm()) {
        return;
    }
    
    const firstName = document.getElementById('firstName')?.value.trim();
    const lastName = document.getElementById('lastName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const code = document.getElementById('verificationCode')?.value.trim();
    
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
    
    if (!validateLoginForm()) {
        return;
    }
    
    const email = document.getElementById('email')?.value.trim();
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
    
    // Валидация пароля в реальном времени
    const passwordError = document.getElementById('passwordError');
    if (passwordError) {
        if (password.length > 0 && password.length < 6) {
            passwordError.textContent = 'Пароль должен быть не менее 6 символов';
            passwordError.style.display = 'block';
            document.getElementById('regPassword').style.borderColor = '#ef4444';
        } else if (password.length >= 6) {
            passwordError.style.display = 'none';
            document.getElementById('regPassword').style.borderColor = '#10b981';
        }
    }
    
    // Проверяем совпадение паролей
    validatePasswordMatch();
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

// Добавляем стили для ошибок валидации
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
    
    .field-error {
        color: #ef4444;
        font-size: 12px;
        margin-top: 5px;
        display: none;
    }
    
    input.error {
        border-color: #ef4444 !important;
    }
    
    input.valid {
        border-color: #10b981 !important;
    }
`;
document.head.appendChild(style);