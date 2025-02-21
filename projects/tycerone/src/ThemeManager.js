export class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.applyTheme(this.currentTheme);
        this.setupBubbles();
    }

    setupBubbles() {
        const pattern = document.querySelector('.background-pattern');
        if (pattern) {
            // 创建6个泡泡
            for (let i = 0; i < 6; i++) {
                const bubble = document.createElement('div');
                bubble.className = 'bubble';
                pattern.appendChild(bubble);
            }
        }
    }

    applyTheme(theme) {
        document.body.classList.toggle('light-theme', theme === 'light');
        localStorage.setItem('theme', theme);
        
        // 更新主题图标
        const themeBtn = document.getElementById('toggle-theme');
        if (themeBtn) {
            themeBtn.innerHTML = theme === 'light' ? 
                '<i class="fas fa-sun"></i>' : 
                '<i class="fas fa-moon"></i>';
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
    }
} 