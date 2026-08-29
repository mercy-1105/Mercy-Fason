const { reactive } = Vue;

export const store = reactive({
    sesionIniciada: false,
    usuarioActual: null,
    cargandoSistema: false,
    mensajeSistema: '',
    baseDatos: {
        usuarios: [], clientes: [], empleados: [], turnos: [], servicios: [], pagos: [], turno_servicios: []
    },
    
    iniciarSesion(usuario) {
        this.usuarioActual = usuario;
        this.sesionIniciada = true;
    },
    
    cerrarSesion() {
        this.usuarioActual = null;
        this.sesionIniciada = false;
        this.baseDatos = { usuarios: [], clientes: [], empleados: [], turnos: [], servicios: [], pagos: [], turno_servicios: [] };
    }
});