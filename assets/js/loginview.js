import { store } from './store.js';
import { supabase, encriptarContrasena } from './main.js';
const { ref } = Vue;

export default {
    emits: ['login-exitoso'],
    setup(props, { emit }) {
        const formularioAcceso = ref({ email: '', password: '' });
        const errorAcceso = ref('');
        const guardandoDatos = ref(false);

        const procesarLogin = async () => {
            guardandoDatos.value = true;
            errorAcceso.value = '';
            
            try {
                const correoSinEspacios = formularioAcceso.value.email.trim();
                const { data: posiblesCuentas, error } = await supabase.from('usuarios').select('*').ilike('email', correoSinEspacios);

                if (error) {
                    errorAcceso.value = 'Tuvimos un problemita técnico: ' + error.message;
                } else if (!posiblesCuentas || posiblesCuentas.length === 0) {
                    errorAcceso.value = 'Mmm... no encontramos a nadie con ese correo. ¿Seguro que está bien escrito?';
                } else {
                    const usuarioElegido = posiblesCuentas[0];
                    const laClaveAlmacenada = String(usuarioElegido.passwordapp || '');
                    const laClaveQueEscribio = String(formularioAcceso.value.password || '');
                    let claveEscritaTransformada = "";
                    try { claveEscritaTransformada = encriptarContrasena(laClaveQueEscribio); } catch (err) {}
                    
                    if (laClaveAlmacenada !== claveEscritaTransformada && laClaveAlmacenada !== laClaveQueEscribio) {
                        errorAcceso.value = '¡Ups! Esa contraseña no es la correcta. Inténtalo de nuevo.';
                    } else if (usuarioElegido.activo === false) {
                        errorAcceso.value = 'Parece que tu cuenta está en pausa. Pide a un administrador que te la vuelva a activar.';
                    } else {
                        store.iniciarSesion(usuarioElegido);
                        emit('login-exitoso');
                    }
                }
            } catch (errorCritico) {
                errorAcceso.value = "Error al intentar conectar con la base de datos.";
            } finally {
                guardandoDatos.value = false;
            }
        };

        return { formularioAcceso, errorAcceso, guardandoDatos, procesarLogin };
    },
    template: `
        <transition name="fade">
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80');">
                <div class="absolute inset-0 bg-brand-900/40 mix-blend-multiply"></div>
                <div class="glass-panel p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-md relative z-10 mx-4">
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500 text-white mb-4 shadow-lg shadow-brand-500/30">
                            <i class="fa-solid fa-spa text-3xl"></i>
                        </div>
                        <h1 class="text-3xl font-bold text-slate-800">Mercy Fason</h1>
                        <p class="text-slate-500 mt-2">Panel de Administración</p>
                    </div>

                    <form @submit.prevent="procesarLogin" class="space-y-6">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Correo Electrónico</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i class="fa-regular fa-envelope text-slate-400"></i>
                                </div>
                                <input v-model="formularioAcceso.email" type="email" required class="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white/50 backdrop-blur-sm transition-all" placeholder="admin@seycobsistem.com">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i class="fa-solid fa-lock text-slate-400"></i>
                                </div>
                                <input v-model="formularioAcceso.password" type="password" required class="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white/50 backdrop-blur-sm transition-all" placeholder="••••••••">
                            </div>
                        </div>

                        <div v-if="errorAcceso" class="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg border border-red-100">
                            <i class="fa-solid fa-circle-exclamation mr-1"></i> {{ errorAcceso }}
                        </div>

                        <button type="submit" class="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors" :disabled="guardandoDatos">
                            <i v-if="guardandoDatos" class="fa-solid fa-spinner fa-spin mr-2"></i>
                            {{ guardandoDatos ? 'Verificando...' : 'Iniciar Sesión' }}
                        </button>
                        
                        <div class="text-xs text-center text-slate-500 mt-4 px-2">
                            Elaborado por <strong> Mercy Jaramillo. </strong>
                        </div>
                    </form>
                </div>
            </div>
        </transition>
    `
};
