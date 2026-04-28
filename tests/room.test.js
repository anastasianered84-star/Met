import {
  joinRoom,
  updateTimer,
  escapeHtml,
  sendMessage
} from '../src/room-script';

beforeEach(() => {
  document.body.innerHTML = `
    <div class="room-info">
      <div class="info-item"><span></span></div>
    </div>
    <input id="messageInput" />
    <div class="chat-messages"></div>
  `;

  fetch.resetMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('TC-04-05: автовыход при истечении времени', () => {
  delete window.location;
  window.location = { href: '' };

  updateTimer(3);

  jest.advanceTimersByTime(4000);

  expect(window.location.href).toContain('catalog.html');
});

test('TC-05-06: экранирование HTML', () => {
  const xss = '<script>alert(1)</script>';
  expect(escapeHtml(xss))
    .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
});