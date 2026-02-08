/**
 * CodingPet 桌面宠物 - 渲染进程入口 (纯 JavaScript, 浏览器直接运行)
 */

// ====== 全局状态 ======
let ws = null;
let currentCharacter = 'cute-girl';
let currentEmotion = 'calm';
let chatOpen = false;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let notificationTimer = null;
let reconnectTimer = null;
let customCharacterImage = null; // 自定义角色图片 Image 对象

// ====== DOM 元素 ======
const petArea = document.getElementById('pet-area');
const petCanvas = document.getElementById('pet-canvas');
const emotionIndicator = document.getElementById('emotion-indicator');
const notificationBubble = document.getElementById('notification-bubble');
const notificationText = document.getElementById('notification-text');
const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const chatCloseBtn = document.getElementById('chat-close-btn');

// ====== 初始化 ======
async function init() {
  console.log('[CodingPet] Initializing overlay...');
  setupMousePassthrough();
  drawCharacter(currentCharacter, currentEmotion);
  setupEventListeners();

  const port = await window.electronAPI.getWSPort();
  connectWebSocket(port);
  startAnimationLoop();
}

// ====== 鼠标穿透控制 ======
function setupMousePassthrough() {
  document.addEventListener('mousemove', function (e) {
    const target = e.target;
    const isInteractive =
      petArea.contains(target) ||
      chatPanel.contains(target) ||
      notificationBubble.contains(target);

    if (!isInteractive && !chatOpen) {
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    } else {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  });

  document.addEventListener('mouseleave', function () {
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  });
}

// ====== WebSocket 连接 ======
function connectWebSocket(port) {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  console.log('[CodingPet] Connecting to ws://127.0.0.1:' + port + '...');
  ws = new WebSocket('ws://127.0.0.1:' + port);

  ws.onopen = function () {
    console.log('[CodingPet] WebSocket connected');
    ws.send(JSON.stringify({ type: 'overlay_ready' }));
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = function (event) {
    try {
      var msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (e) {
      console.error('[CodingPet] Failed to parse message:', e);
    }
  };

  ws.onclose = function () {
    console.log('[CodingPet] WebSocket disconnected, retrying in 3s...');
    ws = null;
    if (!reconnectTimer) {
      reconnectTimer = setInterval(function () {
        connectWebSocket(port);
      }, 3000);
    }
  };

  ws.onerror = function (err) {
    console.error('[CodingPet] WebSocket error:', err);
  };
}

function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ====== 消息处理 ======
function handleMessage(msg) {
  switch (msg.type) {
    case 'chat_response':
      addChatMessage(msg.text, 'assistant');
      setEmotion(msg.emotion || 'calm');
      hideTypingIndicator();
      break;

    case 'code_tip':
      showNotification(msg.text, 'code-tip');
      setEmotion(msg.emotion || 'thinking');
      addChatMessage('[代码提示] ' + msg.text, 'code-tip');
      break;

    case 'proactive_message':
      showNotification(msg.text, msg.category || 'default');
      setEmotion(msg.emotion || 'calm');
      addChatMessage('[' + getCategoryLabel(msg.category) + '] ' + msg.text, 'proactive');
      break;

    case 'emotion_change':
      setEmotion(msg.emotion);
      break;

    case 'config_update':
      if (msg.config) {
        if (msg.config.character && msg.config.character !== currentCharacter) {
          currentCharacter = msg.config.character;
          if (currentCharacter === 'custom' && msg.config.customCharacterPath) {
            loadCustomCharacter(msg.config.customCharacterPath);
          } else {
            customCharacterImage = null;
            drawCharacter(currentCharacter, currentEmotion);
          }
        }
      }
      break;

    case 'change_character':
      currentCharacter = msg.character;
      customCharacterImage = null;
      drawCharacter(currentCharacter, currentEmotion);
      break;

    case 'audio_data':
      playAudio(msg.audioBase64, msg.mimeType);
      break;

    case 'status':
      console.log('[CodingPet] Status:', msg.connected);
      break;
  }
}

function getCategoryLabel(cat) {
  var labels = {
    health: '健康提醒',
    news: '新闻播报',
    mood: '心情关怀',
    philosophy: '人生哲理',
    fun: '趣味分享',
  };
  return labels[cat] || '消息';
}

// ====== 自定义角色加载 ======
function loadCustomCharacter(imagePath) {
  var img = new Image();
  img.onload = function () {
    customCharacterImage = img;
    drawCharacter('custom', currentEmotion);
  };
  img.onerror = function () {
    console.error('[CodingPet] Failed to load custom character:', imagePath);
    customCharacterImage = null;
    currentCharacter = 'cute-girl';
    drawCharacter(currentCharacter, currentEmotion);
  };
  // Electron 环境可以用 file:// 协议加载本地图片
  img.src = 'file:///' + imagePath.replace(/\\/g, '/');
}

// ====== 角色绘制 ======
function drawCharacter(character, emotion) {
  var ctx = petCanvas.getContext('2d');
  ctx.clearRect(0, 0, 200, 200);

  if (character === 'custom' && customCharacterImage) {
    drawCustomCharacter(ctx, emotion);
    return;
  }

  switch (character) {
    case 'cat':
      drawCat(ctx, emotion);
      break;
    case 'dog':
      drawDog(ctx, emotion);
      break;
    case 'cute-girl':
    default:
      drawCuteGirl(ctx, emotion);
      break;
  }
}

function drawCustomCharacter(ctx, emotion) {
  var img = customCharacterImage;
  var size = 160;
  var sx = 0, sy = 0, sw = img.width, sh = img.height;

  if (sw > sh) {
    sx = (sw - sh) / 2;
    sw = sh;
  } else {
    sy = (sh - sw) / 2;
    sh = sw;
  }

  var dx = (200 - size) / 2;
  var dy = (200 - size) / 2 + 10;

  ctx.save();
  ctx.beginPath();
  ctx.arc(100, 110, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, size, size);
  ctx.restore();

  drawOverlayExpression(ctx, 100, 110, emotion);
}

function drawOverlayExpression(ctx, cx, cy, emotion) {
  var emojis = {
    happy: '\u{1F60A}',
    worried: '\u{1F61F}',
    calm: '',
    angry: '\u{1F624}',
    excited: '\u{1F389}',
    thinking: '\u{1F914}',
  };
  var emoji = emojis[emotion] || '';
  if (emoji) {
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, cx + 55, cy + 60);
  }
}

function drawCuteGirl(ctx, emotion) {
  var cx = 100, cy = 110;

  // 身体
  ctx.fillStyle = '#FFE4C4';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 40, 45, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  // 衣服
  ctx.fillStyle = '#FF69B4';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 50, 42, 30, 0, 0, Math.PI);
  ctx.fill();

  // 头
  ctx.fillStyle = '#FFE4C4';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 45, 0, Math.PI * 2);
  ctx.fill();

  // 头发
  ctx.fillStyle = '#4A2828';
  ctx.beginPath();
  ctx.arc(cx, cy - 25, 47, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - 15, cy - 35, 20, 15, -0.2, 0, Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 15, cy - 35, 20, 15, 0.2, 0, Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - 45, cy, 10, 30, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 45, cy, 10, 30, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // 发饰蝴蝶结
  ctx.fillStyle = '#FF1493';
  ctx.beginPath();
  ctx.ellipse(cx + 35, cy - 40, 8, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 43, cy - 36, 8, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // 腮红
  ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - 28, cy + 5, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 28, cy + 5, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  drawEyes(ctx, cx, cy, emotion);
  drawMouth(ctx, cx, cy + 15, emotion);
}

function drawCat(ctx, emotion) {
  var cx = 100, cy = 110;

  // 身体
  ctx.fillStyle = '#FFB347';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 35, 40, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  // 前爪
  ctx.fillStyle = '#FFDEAD';
  ctx.beginPath(); ctx.ellipse(cx - 20, cy + 60, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 20, cy + 60, 10, 8, 0, 0, Math.PI * 2); ctx.fill();

  // 头
  ctx.fillStyle = '#FFB347';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 42, 0, Math.PI * 2);
  ctx.fill();

  // 耳朵
  ctx.beginPath();
  ctx.moveTo(cx - 35, cy - 35);
  ctx.lineTo(cx - 20, cy - 65);
  ctx.lineTo(cx - 5, cy - 35);
  ctx.fillStyle = '#FFB347';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 35, cy - 35);
  ctx.lineTo(cx + 20, cy - 65);
  ctx.lineTo(cx + 5, cy - 35);
  ctx.fill();

  // 内耳
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy - 35);
  ctx.lineTo(cx - 20, cy - 55);
  ctx.lineTo(cx - 10, cy - 35);
  ctx.fillStyle = '#FFB0B0';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 30, cy - 35);
  ctx.lineTo(cx + 20, cy - 55);
  ctx.lineTo(cx + 10, cy - 35);
  ctx.fill();

  // 头顶花纹
  ctx.strokeStyle = '#E8903A';
  ctx.lineWidth = 2.5;
  for (var i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 12 - 5, cy - 48);
    ctx.lineTo(cx + i * 12, cy - 30);
    ctx.stroke();
  }

  // 腮红
  ctx.fillStyle = 'rgba(255, 150, 150, 0.35)';
  ctx.beginPath(); ctx.ellipse(cx - 25, cy + 2, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 25, cy + 2, 10, 6, 0, 0, Math.PI * 2); ctx.fill();

  // 胡须
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 18, cy + 5); ctx.lineTo(cx - 50, cy - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 18, cy + 9); ctx.lineTo(cx - 48, cy + 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 18, cy + 5); ctx.lineTo(cx + 50, cy - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 18, cy + 9); ctx.lineTo(cx + 48, cy + 12); ctx.stroke();

  // 尾巴
  ctx.strokeStyle = '#FFB347';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 35, cy + 50);
  ctx.quadraticCurveTo(cx + 65, cy + 30, cx + 58, cy + 8);
  ctx.stroke();
  // 尾巴尖
  ctx.strokeStyle = '#FFDEAD';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx + 58, cy + 12);
  ctx.lineTo(cx + 58, cy + 5);
  ctx.stroke();

  drawEyes(ctx, cx, cy - 5, emotion);

  // 猫鼻
  ctx.fillStyle = '#FF8888';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 5);
  ctx.lineTo(cx - 5, cy + 10);
  ctx.lineTo(cx + 5, cy + 10);
  ctx.fill();

  drawCatMouth(ctx, cx, cy + 12, emotion);
}

function drawDog(ctx, emotion) {
  var cx = 100, cy = 110;

  // 身体
  ctx.fillStyle = '#D2B48C';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 35, 40, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  // 前爪
  ctx.fillStyle = '#F5E6D3';
  ctx.beginPath(); ctx.ellipse(cx - 18, cy + 62, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 18, cy + 62, 10, 7, 0, 0, Math.PI * 2); ctx.fill();

  // 头
  ctx.fillStyle = '#D2B48C';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 45, 0, Math.PI * 2);
  ctx.fill();

  // 耳朵（下垂）
  ctx.fillStyle = '#A0785A';
  ctx.beginPath();
  ctx.ellipse(cx - 42, cy, 15, 30, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 42, cy, 15, 30, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // 脸部白色区域
  ctx.fillStyle = '#F5E6D3';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, 25, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眉毛斑点
  ctx.fillStyle = '#A0785A';
  ctx.beginPath(); ctx.ellipse(cx - 15, cy - 22, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 15, cy - 22, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();

  // 腮红
  ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
  ctx.beginPath(); ctx.ellipse(cx - 25, cy + 5, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 25, cy + 5, 10, 6, 0, 0, Math.PI * 2); ctx.fill();

  // 尾巴
  ctx.strokeStyle = '#D2B48C';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 35, cy + 45);
  ctx.quadraticCurveTo(cx + 70, cy + 20, cx + 60, cy);
  ctx.stroke();

  // 项圈
  ctx.strokeStyle = '#FF4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy + 28, 28, -0.3, Math.PI + 0.3);
  ctx.stroke();

  // 铃铛
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(cx, cy + 56, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#DAA520';
  ctx.beginPath();
  ctx.arc(cx, cy + 56, 2, 0, Math.PI * 2);
  ctx.fill();

  drawEyes(ctx, cx, cy - 5, emotion);

  // 鼻子
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 鼻子高光
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy + 6, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  drawDogMouth(ctx, cx, cy + 15, emotion);
}

// ====== 共用绘制函数 ======
function drawEyes(ctx, cx, cy, emotion) {
  var leftX = cx - 15, rightX = cx + 15;

  switch (emotion) {
    case 'happy':
    case 'excited':
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(leftX, cy, 8, Math.PI, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(rightX, cy, 8, Math.PI, 2 * Math.PI); ctx.stroke();
      break;

    case 'angry':
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(leftX, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rightX, cy, 6, 0, Math.PI * 2); ctx.fill();
      // 怒眉
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(leftX - 10, cy - 14); ctx.lineTo(leftX + 6, cy - 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rightX + 10, cy - 14); ctx.lineTo(rightX - 6, cy - 9); ctx.stroke();
      break;

    case 'worried':
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.ellipse(leftX, cy, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rightX, cy, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
      // 高光
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(leftX + 2, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rightX + 2, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
      // 忧眉
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(leftX - 10, cy - 10); ctx.lineTo(leftX + 5, cy - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rightX + 10, cy - 10); ctx.lineTo(rightX - 5, cy - 14); ctx.stroke();
      break;

    case 'thinking':
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(leftX, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(leftX + 2, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
      // 右眼闭
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rightX - 7, cy); ctx.lineTo(rightX + 7, cy); ctx.stroke();
      break;

    default: // calm
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(leftX, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rightX, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(leftX + 2, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rightX + 2, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

function drawMouth(ctx, cx, cy, emotion) {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  switch (emotion) {
    case 'happy':
    case 'excited':
      ctx.beginPath(); ctx.arc(cx, cy - 3, 10, 0.2, Math.PI - 0.2); ctx.stroke();
      break;
    case 'angry':
      ctx.beginPath(); ctx.arc(cx, cy + 8, 8, Math.PI + 0.3, 2 * Math.PI - 0.3); ctx.stroke();
      break;
    case 'worried':
      ctx.beginPath(); ctx.arc(cx, cy + 5, 6, Math.PI + 0.5, 2 * Math.PI - 0.5); ctx.stroke();
      break;
    case 'thinking':
      ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 8, cy - 2); ctx.stroke();
      break;
    default:
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0.3, Math.PI - 0.3); ctx.stroke();
      break;
  }
}

function drawCatMouth(ctx, cx, cy, emotion) {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2);
  ctx.lineTo(cx - 8, cy + (emotion === 'happy' || emotion === 'excited' ? -2 : 6));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2);
  ctx.lineTo(cx + 8, cy + (emotion === 'happy' || emotion === 'excited' ? -2 : 6));
  ctx.stroke();
}

function drawDogMouth(ctx, cx, cy, emotion) {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  if (emotion === 'happy' || emotion === 'excited') {
    ctx.beginPath(); ctx.arc(cx, cy - 2, 12, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.fillStyle = '#FF8888';
    ctx.beginPath(); ctx.ellipse(cx, cy + 8, 6, 8, 0, 0, Math.PI); ctx.fill();
  } else {
    drawMouth(ctx, cx, cy, emotion);
  }
}

// ====== 情绪管理 ======
function setEmotion(emotion) {
  currentEmotion = emotion;
  drawCharacter(currentCharacter, emotion);

  var emotionEmojis = {
    happy: '\u{1F60A}',
    worried: '\u{1F61F}',
    calm: '',
    angry: '\u{1F624}',
    excited: '\u{1F389}',
    thinking: '\u{1F914}',
  };
  emotionIndicator.textContent = emotionEmojis[emotion] || '';

  petArea.className = 'pet-area';
  if (emotion !== 'calm') {
    petArea.classList.add('pet-' + emotion);
  } else {
    petArea.classList.add('pet-breathing');
  }
}

// ====== 通知气泡 ======
function showNotification(text, category) {
  notificationText.textContent = text;
  notificationBubble.className = 'notification-bubble';
  if (category && category !== 'default') {
    notificationBubble.classList.add(category);
  }
  notificationBubble.classList.remove('hidden');

  if (notificationTimer) clearTimeout(notificationTimer);
  notificationTimer = setTimeout(function () {
    notificationBubble.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(function () {
      notificationBubble.classList.add('hidden');
      notificationBubble.style.animation = '';
    }, 300);
  }, 8000);
}

// ====== 聊天功能 ======
function toggleChat() {
  chatOpen = !chatOpen;
  if (chatOpen) {
    chatPanel.classList.remove('hidden');
    notificationBubble.classList.add('hidden');
    window.electronAPI.resizeWindow(300, 570);
    chatInput.focus();
  } else {
    chatPanel.classList.add('hidden');
    window.electronAPI.resizeWindow(300, 250);
  }
}

function addChatMessage(text, role) {
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + role;

  var bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;
  msgDiv.appendChild(bubble);

  var time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  msgDiv.appendChild(time);

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  if (document.querySelector('.typing-indicator')) return;
  var indicator = document.createElement('div');
  indicator.className = 'message assistant';
  indicator.innerHTML =
    '<div class="typing-indicator">' +
    '<div class="typing-dot"></div>' +
    '<div class="typing-dot"></div>' +
    '<div class="typing-dot"></div>' +
    '</div>';
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  var ind = chatMessages.querySelector('.typing-indicator');
  if (ind && ind.parentElement) ind.parentElement.remove();
}

function sendChatMessage() {
  var text = chatInput.value.trim();
  if (!text) return;
  addChatMessage(text, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto';
  showTypingIndicator();
  wsSend({ type: 'chat_request', text: text });
}

// ====== 语音输入 ======
async function startRecording() {
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunks = [];

    mediaRecorder.ondataavailable = function (e) {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async function () {
      var audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      var reader = new FileReader();
      reader.onloadend = function () {
        var base64 = reader.result.split(',')[1];
        wsSend({ type: 'voice_input', audioData: base64, mimeType: 'audio/webm' });
        showTypingIndicator();
      };
      reader.readAsDataURL(audioBlob);
      stream.getTracks().forEach(function (t) { t.stop(); });
    };

    mediaRecorder.start();
    isRecording = true;
    voiceBtn.classList.add('recording');
    voiceBtn.textContent = '\u23F9';
  } catch (err) {
    console.error('[CodingPet] Recording failed:', err);
    addChatMessage('\u65E0\u6CD5\u8BBF\u95EE\u9EA6\u514B\u98CE\uFF0C\u8BF7\u68C0\u67E5\u6743\u9650\u8BBE\u7F6E', 'assistant');
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    voiceBtn.classList.remove('recording');
    voiceBtn.textContent = '\u{1F3A4}';
  }
}

// ====== 音频播放 ======
function playAudio(base64Data, mimeType) {
  try {
    var binaryString = atob(base64Data);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    var audioBlob = new Blob([bytes], { type: mimeType || 'audio/mp3' });
    var audioUrl = URL.createObjectURL(audioBlob);
    var audio = new Audio(audioUrl);

    audio.onplay = function () {
      petArea.className = 'pet-area pet-talking';
    };
    audio.onended = function () {
      setEmotion(currentEmotion);
      URL.revokeObjectURL(audioUrl);
    };
    audio.play().catch(function (err) {
      console.error('[CodingPet] Audio playback error:', err);
    });
  } catch (err) {
    console.error('[CodingPet] Audio decode error:', err);
  }
}

// ====== 动画循环 ======
function startAnimationLoop() {
  setInterval(function () {
    // idle animation handled by CSS
  }, 3000);
}

// ====== 事件绑定 ======
function setupEventListeners() {
  petArea.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleChat();
  });

  chatCloseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (chatOpen) toggleChat();
  });

  sendBtn.addEventListener('click', sendChatMessage);

  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  chatInput.addEventListener('input', function () {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
  });

  voiceBtn.addEventListener('click', function () {
    if (isRecording) {
      stopRecording();
    } else {
      if (!chatOpen) toggleChat();
      startRecording();
    }
  });

  notificationBubble.addEventListener('click', function () {
    notificationBubble.classList.add('hidden');
    if (!chatOpen) toggleChat();
  });

  // Escape to close chat
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && chatOpen) {
      toggleChat();
    }
  });
}

// ====== 启动 ======
document.addEventListener('DOMContentLoaded', init);
