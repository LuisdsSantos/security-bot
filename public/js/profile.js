const API_BASE_URL = "http://localhost:3000"; 

async function loadProfile() {
    const userId = sessionStorage.getItem('user_id');
    
    if (!userId) {
        window.location.href = 'login.html'; 
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}`);
        const user = await response.json();

        if (response.ok) {
            // Dados básicos
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userEmail').textContent = user.email; // NOVO
            document.getElementById('userLevel').textContent = user.level;
            document.getElementById('userLevelBadge').textContent = user.level; // Badge no card
            document.getElementById('points').textContent = user.points;
            
            // Lógica de Progresso (Ex: Cada nível precisa de 1000 pontos)
            // Se o usuário tem 1500 pontos, ele tem 50% do caminho para o próximo (considerando base 1000)
            // Vamos simplificar: Progresso = (Pontos % 1000) / 10
            const currentLevelPoints = user.points % 1000;
            const progress = (currentLevelPoints / 1000) * 100;
            
            document.getElementById('bar').style.width = `${progress}%`;
            document.getElementById('progressPercent').textContent = `${Math.floor(progress)}%`;
            
            // Lógica de Badges (Opcional - Simulação)
            unlockBadges(user.points);
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

// Função visual para "desbloquear" emblemas baseado em pontos
function unlockBadges(points) {
    const badgesContainer = document.getElementById('badges');
    // Limpa os badges estáticos do HTML
    badgesContainer.innerHTML = '';

    const badgeList = [
        { icon: 'fa-shield-halved', required: 0, name: 'Iniciante' },
        { icon: 'fa-bug', required: 500, name: 'Caçador' },
        { icon: 'fa-user-secret', required: 1500, name: 'Hacker Ético' },
        { icon: 'fa-lock', required: 3000, name: 'Criptógrafo' }
    ];

    badgeList.forEach(badge => {
        const isUnlocked = points >= badge.required;
        const div = document.createElement('div');
        div.className = `badge ${isUnlocked ? 'unlocked' : 'locked'}`;
        div.innerHTML = `<i class="fa-solid ${badge.icon}"></i>`;
        div.title = badge.name + (isUnlocked ? ' (Desbloqueado)' : ' (Bloqueado)');
        
        if(isUnlocked) {
            div.style.color = '#ffd700'; // Dourado
            div.style.borderColor = '#ffd700';
        }
        
        badgesContainer.appendChild(div);
    });
}

document.getElementById('btnLogout').addEventListener('click', () => {
    if(confirm("Tem certeza que deseja sair?")) {
        sessionStorage.clear();
        window.location.href = 'welcome.html';
    }
});

// ... (código anterior de carregamento do perfil) ...

/* --- LÓGICA DOS MODAIS --- */

// Elementos
const modalEdit = document.getElementById('modalEdit');
const modalPassword = document.getElementById('modalPassword');

// 1. ABRIR MODAL DE EDITAR DADOS
document.getElementById('btnEditData').addEventListener('click', () => {
    // Preenche os campos com os dados atuais da tela
    document.getElementById('editName').value = document.getElementById('userName').textContent;
    document.getElementById('editEmail').value = document.getElementById('userEmail').textContent;
    
    // Mostra o modal
    modalEdit.classList.remove('hidden');
});

// 2. ABRIR MODAL DE SENHA
document.getElementById('btnChangePassword').addEventListener('click', () => {
    // Limpa os campos por segurança
    document.getElementById('formChangePassword').reset();
    modalPassword.classList.remove('hidden');
});

// 3. FECHAR MODAIS (Botões X e Cancelar)
function closeModal(modal) {
    modal.classList.add('hidden');
}

document.getElementById('closeEdit').addEventListener('click', () => closeModal(modalEdit));
document.getElementById('cancelEdit').addEventListener('click', () => closeModal(modalEdit));

document.getElementById('closePassword').addEventListener('click', () => closeModal(modalPassword));
document.getElementById('cancelPassword').addEventListener('click', () => closeModal(modalPassword));

// Fecha ao clicar fora do modal (Overlay)
window.addEventListener('click', (e) => {
    if (e.target === modalEdit) closeModal(modalEdit);
    if (e.target === modalPassword) closeModal(modalPassword);
});


/* --- ENVIAR FORMULÁRIOS PARA A API --- */

// 1. Salvar Dados Pessoais
document.getElementById('formEditData').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = sessionStorage.getItem('user_id');
    const newName = document.getElementById('editName').value;
    const newEmail = document.getElementById('editEmail').value;

    try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, email: newEmail })
        });

        if (response.ok) {
            alert('Dados atualizados com sucesso!');
            closeModal(modalEdit);
            loadProfile(); // Recarrega a tela
        } else {
            const data = await response.json();
            alert(data.error || 'Erro ao atualizar.');
        }
    } catch (error) {
        alert('Erro de conexão.');
    }
});

// 2. Atualizar Senha
document.getElementById('formChangePassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = sessionStorage.getItem('user_id');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 8) {
        alert('A nova senha deve ter pelo menos 8 caracteres.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('A confirmação da senha não confere.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (response.ok) {
            alert('Senha alterada com sucesso!');
            closeModal(modalPassword);
        } else {
            const data = await response.json();
            alert(data.error || 'Erro ao alterar senha.');
        }
    } catch (error) {
        alert('Erro de conexão.');
    }
});

loadProfile();