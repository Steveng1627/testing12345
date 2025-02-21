export class SoundManager {
    static sounds = {
        place: new Audio('assets/sounds/place.mp3'),
        battle: new Audio('assets/sounds/battle.mp3'),
        fusion: new Audio('assets/sounds/fusion.mp3'),
        victory: new Audio('assets/sounds/victory.mp3'),
        defeat: new Audio('assets/sounds/defeat.mp3'),
        move: new Audio('assets/sounds/move.mp3'),
        select: new Audio('assets/sounds/select.mp3'),
        error: new Audio('assets/sounds/error.mp3'),
        bgm: new Audio('assets/sounds/background.mp3')
    };

    static volume = 0.7;
    static enabled = true;

    constructor() {
        // 预加载所有音效
        Object.values(SoundManager.sounds).forEach(sound => {
            sound.load();
        });
        
        // 从本地存储加载设置
        const savedVolume = localStorage.getItem('sound-volume');
        const savedEnabled = localStorage.getItem('sound-enabled');
        
        if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            // 确保音量是有效的数字且在正确范围内
            if (!isNaN(volume) && isFinite(volume) && volume >= 0 && volume <= 1) {
                SoundManager.volume = volume;
            }
        }
        
        if (savedEnabled !== null) {
            SoundManager.enabled = savedEnabled === 'true';
        }
        
        // 初始化背景音乐
        SoundManager.sounds.bgm.loop = true;
        
        // 设置背景音乐音量
        const bgmVolume = Math.min(Math.max(SoundManager.volume * 0.3, 0), 1);
        SoundManager.sounds.bgm.volume = bgmVolume;
        
        // 更新所有音效音量
        SoundManager.updateAllVolumes();
        
        // 自动播放（需要用户交互）
        document.addEventListener('click', () => {
            if (SoundManager.enabled && !this.bgmStarted) {
                SoundManager.sounds.bgm.play().catch(() => {
                    console.log('BGM autoplay failed - waiting for user interaction');
                });
                this.bgmStarted = true;
            }
        }, { once: true });
    }

    static updateAllVolumes() {
        Object.entries(this.sounds).forEach(([key, sound]) => {
            try {
                // 背景音乐使用较低音量
                const volume = key === 'bgm' ? 
                    Math.min(Math.max(this.volume * 0.3, 0), 1) : 
                    Math.min(Math.max(this.volume, 0), 1);
                sound.volume = volume;
            } catch (e) {
                console.warn(`Failed to set volume for ${key}:`, e);
            }
        });
    }

    static play(soundName) {
        if (!this.enabled) return;
        
        const sound = this.sounds[soundName];
        if (sound) {
            // 克隆音频对象以支持重叠播放
            const soundClone = sound.cloneNode();
            soundClone.volume = this.volume;
            soundClone.play().catch(e => console.log('Sound play failed:', e));
        }
    }

    static setVolume(value) {
        this.volume = value;
        this.updateAllVolumes();
        localStorage.setItem('sound-volume', value);
    }

    static toggle(enabled) {
        this.enabled = enabled;
        localStorage.setItem('sound-enabled', enabled);
        this.toggleBGM(enabled);
    }

    static toggleBGM(enabled) {
        if (enabled) {
            this.sounds.bgm.play();
        } else {
            this.sounds.bgm.pause();
        }
    }
}

export default SoundManager; 