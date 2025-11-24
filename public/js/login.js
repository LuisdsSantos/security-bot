const API_BASE_URL = "http://localhost:3000"; 

document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = e.target.email.value;
    const password = e.target.password.value;
    const msg = document.getElementById('msg');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Salva os dados do usuário na sessão do navegador
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_name', data.user.name);
            
            // Redireciona para o chat
            window.location.href = 'home.html';
        } else {
            msg.textContent = data.error || 'Erro ao entrar.';
        }
    } catch (error) {
        msg.textContent = 'Erro de conexão.';
    }
});