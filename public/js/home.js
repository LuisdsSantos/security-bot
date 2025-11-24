
const API_BASE_URL = "http://localhost:3000"; 

// --- ELEMENTOS DO DOM ---
const toggleButton = document.getElementById("btnToggleSidebar");
const sidebar = document.getElementById("sidebarChat");
const inputMsg = document.getElementById("inputMsg");
const btnSend = document.getElementById("btnSend");
const messagesEl = document.getElementById("messages");
const formChat = document.getElementById("formChat");
const btnNewChat = document.getElementById("btnNewChat");
const sidebarHistoryEl = document.getElementById("sidebarHistory");

const btnProfile = document.getElementById("btnProfile");
const btnLogoutSidebar = document.getElementById("btnLogoutSidebar");

// --- FUNÇÕES DE SEGURANÇA E UTILIDADE ---
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- LÓGICA DA SIDEBAR ---
function toggleSidebar() {
  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    sidebar.classList.toggle("expanded");
  } else {
    sidebar.classList.toggle("collapsed");
  }
}
toggleButton.addEventListener("click", toggleSidebar);

// --- LÓGICA DO INPUT DE MENSAGEM ---
inputMsg.addEventListener("input", () => {
  btnSend.disabled = inputMsg.value.trim().length === 0;
});

// --- FUNÇÕES DE EXIBIÇÃO DE MENSAGEM ---

function addMessage(who, text, timestamp = null, messageId = null) {
  const li = document.createElement("li");
  li.className = `msg ${who}`;
  
  const timeString = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  const label = who === "user" ? "Você" : "Assistente";

  // Lógica para mensagens do BOT (Pode conter Markdown + Quiz)
  if (who === 'model' || who === 'bot') {
      // 1. Tenta extrair o JSON do Quiz (Exatamente como no addBotReply)
      const quizRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = text.match(quizRegex);
      
      let cleanText = text;
      let quizData = null;

      if (match) {
        try {
          quizData = JSON.parse(match[1]).quiz;
          cleanText = text.replace(quizRegex, "").trim();
        } catch (e) {
          console.error("Erro ao processar quiz no histórico", e);
        }
      }

      // 2. Renderiza o Texto (Markdown)
      const htmlContent = marked.parse(cleanText);
      
      const contentDiv = document.createElement('div');
      contentDiv.innerHTML = htmlContent;
      li.appendChild(contentDiv);

      // 3. Se tiver Quiz, renderiza os botões
      if (quizData) {
        const quizEl = renderQuiz(quizData);
        li.appendChild(quizEl);
      }

      const metaSpan = document.createElement('span');
      metaSpan.className = "meta";
      metaSpan.innerHTML = `${label} • ${timeString}`;
      li.appendChild(metaSpan);

  } else {
      // Lógica para mensagens do USUÁRIO (Texto simples)
      li.innerHTML = `<div>${escapeHtml(text)}</div><span class="meta">${label} • ${timeString}</span>`;
  }

  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addBotReply(fullText, messageId = null) {
  const li = document.createElement("li");
  li.className = `msg bot`;
  
  // 1. Tenta extrair o JSON do Quiz (Regex procura por ```json { ... } ```)
  const quizRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = fullText.match(quizRegex);
  
  let cleanText = fullText;
  let quizData = null;

  if (match) {
    try {
      quizData = JSON.parse(match[1]).quiz;
      // Remove o bloco JSON do texto para não aparecer duplicado
      cleanText = fullText.replace(quizRegex, "").trim();
    } catch (e) {
      console.error("Erro ao processar quiz JSON", e);
    }
  }

  // 2. Renderiza o texto normal (Markdown)
  const htmlContent = marked.parse(cleanText);
  
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = htmlContent;

  li.appendChild(contentDiv);

  // 3. Se tiver quiz, renderiza os botões embaixo
  if (quizData) {
    const quizEl = renderQuiz(quizData, messageId);
    li.appendChild(quizEl);
  }

  // Feedback e Meta (igual antes)
  const feedbackDiv = document.createElement('div');
  feedbackDiv.className = "feedback";
  feedbackDiv.innerHTML = `
      <button class="btnLike">Útil</button>
      <button class="btnDislike">Não útil</button>
  `;
  li.appendChild(feedbackDiv);

  const metaSpan = document.createElement('span');
  metaSpan.className = "meta";
  metaSpan.textContent = `Assistente • ${new Date().toLocaleTimeString()}`;
  li.appendChild(metaSpan);

  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- FUNÇÃO DE RENDERIZAR O QUIZ ---
function renderQuiz(quiz, messageId) {
  const container = document.createElement('div');
  container.className = 'quiz-container';

  const questionEl = document.createElement('div');
  questionEl.className = 'quiz-question';
  questionEl.innerHTML = `<i class="fa-solid fa-trophy"></i> Desafio: ${quiz.question}`;
  container.appendChild(questionEl);

  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'quiz-options';

  // Cria botões para cada opção
  quiz.options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-btn';
    btn.textContent = option;
    
    btn.onclick = () => handleQuizAnswer(btn, index, quiz, optionsDiv, messageId);
    
    optionsDiv.appendChild(btn);
  });

  container.appendChild(optionsDiv);
  return container;
}

// --- LÓGICA AO RESPONDER ---
async function handleQuizAnswer(clickedBtn, selectedIndex, quiz, parentDiv, messageId) {
  // Se não tiver ID (ex: mensagens antigas antes dessa atualização), avisa
  if (!messageId) {
      alert("Este quiz é muito antigo e não vale mais pontos.");
      // Continua visualmente só para feedback, ou retorna

      return;
  }
  // 1. Bloqueia todos os botões para não clicar duas vezes
  const allBtns = parentDiv.querySelectorAll('.quiz-btn');
  allBtns.forEach(b => b.disabled = true);

  const isCorrect = selectedIndex === quiz.correctIndex;

  // 2. Aplica estilos visuais
  if (isCorrect) {
    clickedBtn.classList.add('correct');
    clickedBtn.innerHTML += ' <i class="fa-solid fa-check"></i>';
    
    // Chama função de ganhar pontos
    await awardPoints(50, messageId); // 50 XP por acerto
  } else {
    clickedBtn.classList.add('wrong');
    clickedBtn.innerHTML += ' <i class="fa-solid fa-xmark"></i>';
    
    // Mostra qual era a correta
    allBtns[quiz.correctIndex].classList.add('correct');
  }

  // 3. Mostra explicação
  const explDiv = document.createElement('div');
  explDiv.className = 'quiz-explanation';
  explDiv.innerHTML = `<strong>${isCorrect ? 'Boa!' : 'Ops!'}</strong> ${quiz.explanation}`;
  parentDiv.parentNode.appendChild(explDiv);
  
  // Rola a tela para ler a explicação
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- FUNÇÃO PARA CHAMAR API DE PONTOS ---
async function awardPoints(amount, messageId) {
  const userId = sessionStorage.getItem('user_id');
  if (!userId) return; // Se não tiver logado, apenas ignora

  try {
    const response = await fetch(`${API_BASE_URL}/gamification/add-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, points: amount, messageId })
    });

    const data = await response.json();

    if (response.status === 409) {
        // Erro de conflito (Já respondeu)
        showToast("⚠️ Você já pontuou neste quiz!");
        return;
    }
    
    if (data.success) {
      // Efeito de Toast (Notificação)
      showToast(`+${amount} XP Ganho!`);
      
      if (data.leveledUp) {
        // Abre o modal de Level Up
        showLevelUpModal(data.newLevel);
      }
    }
  } catch (error) {
    console.error("Erro ao dar pontos", error);
  }
}

// Função auxiliar de Toast
function showToast(msg) {
    const toast = document.getElementById('toast');
    if(!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.style.display = 'none', 300);
    }, 3000);
}

// Função auxiliar Modal Level Up
function showLevelUpModal(newLevel) {
    const modal = document.getElementById('modal');
    if(!modal) return;
    
    document.getElementById('modalTitle').textContent = "Nível Subiu! 🚀";
    document.getElementById('modalBody').textContent = `Parabéns! Você agora é um "${newLevel}".`;
    
    modal.hidden = false;
    modal.style.display = 'flex'; // Garante flex para centralizar
    
    // Botão fechar do modal
    document.getElementById('modalClose').onclick = () => {
        modal.hidden = true;
        modal.style.display = 'none';
    };
}

function addThinkingIndicator() {
  const li = document.createElement("li");
  li.id = "thinking-indicator";
  li.className = "msg bot";
  li.innerHTML = `
    <div class="typing-indicator"><span></span><span></span><span></span></div>
    <span class="meta">Assistente • ${new Date().toLocaleTimeString()}</span>
  `;
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeThinkingIndicator() {
  const indicator = document.getElementById("thinking-indicator");
  if (indicator) indicator.remove();
}

// --- LÓGICA DE SESSÃO E API ---

function getOrCreateSessionId() {
  let sessionId = sessionStorage.getItem("chat_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("chat_session_id", sessionId);
  }
  return sessionId;
}

async function createNewChat() {
  sessionStorage.removeItem("chat_session_id");
  messagesEl.innerHTML = "";

  // Recarrega a lista para garantir que a sessão anterior apareça
  await loadHistoryList();
}

btnNewChat.addEventListener("click", createNewChat);

// --- INTEGRAÇÃO: CARREGAR LISTA DE HISTÓRICO ---
async function loadHistoryList() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-history-list`);
        if (!response.ok) return;
        
        const history = await response.json();
        sidebarHistoryEl.innerHTML = ""; // Limpa lista atual

        history.forEach(item => {

            const title = item.title || "Conversa sem título"; 
            addChatToSidebar(item.session_id, title);
        });
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
}

async function deleteSession(sessionId, elementToRemove) {
  if (!confirm("Tem certeza que deseja excluir esta conversa?")) return;

  try {
    const response = await fetch(`${API_BASE_URL}/history/${sessionId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      // 1. Remove o item da tela com uma animaçãozinha
      elementToRemove.style.opacity = "0";
      setTimeout(() => elementToRemove.remove(), 300);

      // 2. Se a conversa deletada for a que está aberta agora, limpa a tela
      if (sessionStorage.getItem("chat_session_id") === sessionId) {
        createNewChat();
      }
    } else {
      alert("Erro ao excluir conversa.");
    }
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro de conexão.");
  }
}

function addChatToSidebar(sessionId, title) {

  const chatItem = document.createElement("div");
  chatItem.className = "btn flat sidebar-chat-item";
  chatItem.dataset.sessionId = sessionId;
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "chat-item-content";
  contentWrapper.style.display = "flex";
  contentWrapper.style.alignItems = "center";
  contentWrapper.style.gap = "8px";
  contentWrapper.style.flex = "1"; 
  
  const textSpan = document.createElement("span");
  textSpan.className = "btn-text";
  textSpan.textContent = title;

  contentWrapper.appendChild(textSpan);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-delete-chat";
  deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  deleteBtn.title = "Excluir conversa";

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteSession(sessionId, chatItem);
  });

  // Monta o item
  chatItem.appendChild(contentWrapper);
  chatItem.appendChild(deleteBtn);

  // Evento de Carregar Conversa (clique na área do texto)
  chatItem.addEventListener("click", () => loadConversation(sessionId));

  sidebarHistoryEl.appendChild(chatItem);
}

// --- INTEGRAÇÃO: CARREGAR CONVERSA ESPECÍFICA ---
async function loadConversation(sessionId) {
    try {
        // 1. Define a sessão atual como a clicada
        sessionStorage.setItem("chat_session_id", sessionId);
        
        // 2. Limpa a tela
        messagesEl.innerHTML = "";
        addThinkingIndicator(); // Feedback visual de carregamento

        // 3. Busca mensagens na API
        const response = await fetch(`${API_BASE_URL}/get-messages/${sessionId}`);
        const messages = await response.json();

        removeThinkingIndicator();

        // 4. Renderiza mensagens
        if (messages.length === 0) {
            addBotReply("Essa conversa está vazia ou não foi encontrada.");
        } else {
            messages.forEach(msg => {
                // A API retorna 'user' ou 'model'. O front usa 'user' ou 'bot'/'model'
                addMessage(msg.role, msg.message, msg.created_at, msg.id);
            });
        }
        
        // Fecha sidebar no mobile
        if (window.innerWidth <= 900) sidebar.classList.remove("expanded");

    } catch (error) {
        console.error("Erro ao carregar conversa:", error);
        removeThinkingIndicator();
    }
}

// --- LÓGICA PRINCIPAL DE ENVIO (SUBMIT) ---
formChat.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userText = inputMsg.value.trim();
  if (!userText) return;

  addMessage("user", userText);
  inputMsg.value = "";
  btnSend.disabled = true;
  addThinkingIndicator();

  const sessionId = getOrCreateSessionId();

  try {
    const response = await fetch(`${API_BASE_URL}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, sessionId: sessionId }),
    });

    if (!response.ok) throw new Error(`Erro API: ${response.status}`);

    const data = await response.json();
    
    const botText = data.response || "Sem resposta do servidor.";
    
    addBotReply(botText,data.messageId);
    
// --- LÓGICA DE ATUALIZAÇÃO DO TÍTULO ---
    
    // 1. Tenta achar o item na barra lateral
    let sidebarItem = document.querySelector(`.sidebar-chat-item[data-session-id="${sessionId}"]`);

    // 2. Se o backend mandou um título novo (significa que é chat novo)
    if (data.title) {
        if (sidebarItem) {
            // Se o item já existir (raro, mas possível), atualiza o texto
            const textSpan = sidebarItem.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = data.title;
        } else {
            // Se não existir, CRIA O ITEM AGORA com o título certo
            addChatToSidebar(sessionId, data.title);
        }
    } 
    // 3. Fallback: Se não veio título mas o item também não existe na tela
    // (Caso de erro ou delay, cria um genérico para não sumir)
    else if (!sidebarItem) {
        addChatToSidebar(sessionId, "Novo Chat");
    }

  } catch (error) {
    console.error("Erro:", error);
    addBotReply("Erro de conexão com o servidor SecurityBot.");
  } finally {
    removeThinkingIndicator();
  }
});

// --- INICIALIZAÇÃO ---
// Carrega o histórico ao abrir a página
loadHistoryList();

// Se não tiver mensagens na tela (nova sessão), mostra boas-vindas
if (!sessionStorage.getItem("chat_session_id")) {
    // addBotReply("Olá! Sou o SecurityBot. Como posso ajudar com sua dúvida de cibersegurança hoje?");
} else {
    // Se já existir um ID na sessão (page refresh), recarrega as mensagens dele
    const currentSession = sessionStorage.getItem("chat_session_id");
    loadConversation(currentSession);
}

// --- VERIFICAÇÃO DE AUTENTICAÇÃO (SEGURANÇA) ---
// Se não tiver usuário logado, manda pro login
const userId = sessionStorage.getItem('user_id');
if (!userId) {
    window.location.href = 'login.html';
}

// --- EVENTOS DE NAVEGAÇÃO (PERFIL E LOGOUT) ---

// 1. Botão de Perfil
if (btnProfile) {
    btnProfile.addEventListener("click", () => {
        // Redireciona para a página de perfil
        window.location.href = "profile.html";
    });
}

// 2. Botão de Logout
if (btnLogoutSidebar) {
    btnLogoutSidebar.addEventListener("click", () => {
        // Confirmação opcional
        if (confirm("Deseja realmente sair?")) {
            // Limpa toda a sessão (usuário, chat atual, token, etc)
            sessionStorage.clear();
            
            // Redireciona para a tela de login ou boas-vindas
            window.location.href = "login.html";
        }
    });
}