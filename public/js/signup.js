const API_BASE_URL = "http://localhost:3000"; // Deixe vazio se estiver no mesmo domínio, ou http://localhost:3000

document.getElementById('formSignup').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    const msg = document.getElementById('msg');

    if(password.length < 8) {
        msg.textContent = "A senha deve ter no mínimo 8 caracteres.";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Conta criada com sucesso!');
            window.location.href = 'login.html';
        } else {
            msg.textContent = data.error || 'Erro ao criar conta.';
        }
    } catch (error) {
        msg.textContent = 'Erro de conexão.';
    }
});