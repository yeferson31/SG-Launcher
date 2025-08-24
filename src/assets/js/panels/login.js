/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.selectedMode = 'online'; // Modo por defecto

        const loginHome = document.querySelector('.login-home');
        const loginOffline = document.querySelector('.login-offline');
        const onlineBtn = document.querySelector('.btn-mode-online');
        const offlineBtn = document.querySelector('.btn-mode-offline');

        // Inicializar modo online por defecto
        this.setMode('online');

        // Event listeners para botones de modo
        onlineBtn.addEventListener('click', () => this.setMode('online'));
        offlineBtn.addEventListener('click', () => this.setMode('offline'));

        document.querySelector('.cancel-home').addEventListener('click', () => {
            document.querySelector('.cancel-home').style.display = 'block'
            changePanel('settings')
        })

        // Botón conectar online
        document.querySelector('.connect-home').onclick = async () => {
            if (this.selectedMode !== 'online') {
                new popup().openPopup({
                    title: 'Error',
                    content: 'Por favor, selecciona el modo Premium para iniciar sesión con Microsoft.',
                    options: true
                });
                return;
            }

            if (typeof this.config.online == 'boolean') {
                if (this.config.online) {
                    await this.microsoftLoginFlow();
                } else {
                    new popup().openPopup({
                        title: 'Error',
                        content: 'El servidor solo permite cuentas offline.',
                        options: true
                    });
                }
            } else if (typeof this.config.online == 'string') {
                if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
                    await this.azauthLoginFlow();
                }
            }
        };

        // Botón conectar offline
        document.querySelector('.connect-offline').onclick = async () => {
            if (this.selectedMode !== 'offline') {
                new popup().openPopup({
                    title: 'Error',
                    content: 'Por favor, selecciona el modo No Premium para crear una cuenta offline.',
                    options: true
                });
                return;
            }
            await this.offlineLoginFlow();
        };
    }

    // Método para cambiar entre modos online/offline
    setMode(mode) {
        this.selectedMode = mode;
        const loginHome = document.querySelector('.login-home');
        const loginOffline = document.querySelector('.login-offline');
        const onlineBtn = document.querySelector('.btn-mode-online');
        const offlineBtn = document.querySelector('.btn-mode-offline');

        // Actualizar botones
        onlineBtn.classList.toggle('active', mode === 'online');
        offlineBtn.classList.toggle('active', mode === 'offline');

        // Mostrar/ocultar formularios
        if (mode === 'online') {
            loginHome.style.display = 'block';
            loginOffline.style.display = 'none';
        } else {
            loginHome.style.display = 'none';
            loginOffline.style.display = 'block';
        }
    }

    // Lógica de login Microsoft directa, sin event listener interno
    async microsoftLoginFlow() {
        let popupLogin = new popup();
        popupLogin.openPopup({
            title: 'Conectando',
            content: 'Por favor, espera...',
            color: 'var(--color)'
        });

        try {
            const account_connect = await ipcRenderer.invoke('Microsoft-window', this.config.client_id);
            if (account_connect == 'cancel' || !account_connect) {
                popupLogin.closePopup();
                return;
            }
            await this.saveData(account_connect)
            popupLogin.closePopup();
        } catch (err) {
            popupLogin.openPopup({
                title: 'Error',
                content: err,
                options: true
            });
        }
    }

    // Lógica de login offline directa, sin event listener interno
    async offlineLoginFlow() {
        let popupLogin = new popup();
        let emailOffline = document.querySelector('.email-offline');
        if (emailOffline.value.length < 3) {
            popupLogin.openPopup({
                title: 'Error',
                content: 'El nombre de usuario debe tener al menos 3 caracteres.',
                options: true
            });
            return;
        }
        if (emailOffline.value.match(/ /g)) {
            popupLogin.openPopup({
                title: 'Error',
                content: 'El nombre de usuario no debe contener espacios.',
                options: true
            });
            return;
        }
        // Generar UUID local para cuenta offline (método mejorado)
        const generateOfflineUUID = (username) => {
            // Usar un hash simple basado en el nombre de usuario
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
                hash = (hash << 5) - hash + username.charCodeAt(i);
                hash |= 0; // Convertir a entero de 32 bits
            }
            // Asegurar que el hash sea positivo
            const positiveHash = Math.abs(hash) || 1; // Evitar 0
            const uuid = `offline-${positiveHash.toString(16).padStart(32, '0')}`;
            return uuid;
        };

        let offlineAccount = {
            ID: generateOfflineUUID(emailOffline.value),
            name: emailOffline.value,
            meta: {
                type: 'Offline',
                online: false
            }
        };

        console.log('Cuenta offline creada:', offlineAccount); // Debug
        await this.saveData(offlineAccount)
        popupLogin.closePopup();
    }

    // Lógica de login AZauth directa, sin event listener interno
    async azauthLoginFlow() {
        let AZauthClient = new AZauth(this.config.online);
        let PopupLogin = new popup();
        let loginAZauth = document.querySelector('.login-AZauth');
        let loginAZauthA2F = document.querySelector('.login-AZauth-A2F');
        let AZauthEmail = document.querySelector('.email-AZauth');
        let AZauthPassword = document.querySelector('.password-AZauth');
        let AZauthA2F = document.querySelector('.A2F-AZauth');
        let AZauthCancelA2F = document.querySelector('.cancel-AZauth-A2F');
        let connectAZauthA2F = document.querySelector('.connect-AZauth-A2F');

        loginAZauth.style.display = 'block';
        loginAZauthA2F.style.display = 'none';

        PopupLogin.openPopup({
            title: 'Conectando...',
            content: 'Por favor, espera...',
            color: 'var(--color)'
        });

        if (AZauthEmail.value == '' || AZauthPassword.value == '') {
            PopupLogin.openPopup({
                title: 'Error',
                content: 'Por favor, rellena todos los campos.',
                options: true
            });
            return;
        }

        let AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value);

        if (AZauthConnect.error) {
            PopupLogin.openPopup({
                title: 'Error',
                content: AZauthConnect.message,
                options: true
            });
            return;
        } else if (AZauthConnect.A2F) {
            loginAZauthA2F.style.display = 'block';
            loginAZauth.style.display = 'none';
            PopupLogin.closePopup();

            // Esperar a que el usuario ingrese el código y pulse validar
            return new Promise((resolve) => {
                AZauthCancelA2F.onclick = () => {
                    loginAZauthA2F.style.display = 'none';
                    loginAZauth.style.display = 'block';
                    resolve();
                };
                connectAZauthA2F.onclick = async () => {
                    PopupLogin.openPopup({
                        title: 'Conectando...',
                        content: 'Por favor, espera...',
                        color: 'var(--color)'
                    });

                    if (AZauthA2F.value == '') {
                        PopupLogin.openPopup({
                            title: 'Error',
                            content: 'Por favor, ingresa el código A2F.',
                            options: true
                        });
                        return;
                    }

                    let AZauthConnect2 = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value, AZauthA2F.value);

                    if (AZauthConnect2.error) {
                        PopupLogin.openPopup({
                            title: 'Error',
                            content: AZauthConnect2.message,
                            options: true
                        });
                        return;
                    }

                    await this.saveData(AZauthConnect2)
                    PopupLogin.closePopup();
                    resolve();
                };
            });
        } else if (!AZauthConnect.A2F) {
            await this.saveData(AZauthConnect)
            PopupLogin.closePopup();
        }
    }

    // Guardar cuenta (online/offline)
    async saveData(connectionData) {
        let configClient = await this.db.readData('configClient');
        let account = await this.db.createData('accounts', connectionData)
        let instanceSelect = configClient.instance_selct
        let instancesList = await config.getInstanceList()
        configClient.account_selected = account.ID;

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == account.name)
                if (whitelist !== account.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        configClient.instance_selct = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }

        await this.db.updateData('configClient', configClient);
        await addAccount(account);
        await accountSelect(account);
        changePanel('home');
    }
}
// Documentación: Lógica de cuentas offline añadida en offlineLoginFlow and saveData()
export default Login;
