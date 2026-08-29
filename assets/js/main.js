import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { store } from './store.js';
import LoginView from './views/LoginView.js';

export const SUPABASE_URL = 'https://uijyqrbdkrikbmvfqdrz.supabase.co'; 
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpanlxcmJka3Jpa2JtdmZxZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODI0OTAsImV4cCI6MjA5OTk1ODQ5MH0.5NLTo68u2JbGui2fLiBvvfiGDY8bC7ZYgQZQUyygles';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const encriptarContrasena = (textoPlano) => CryptoJS.SHA256(textoPlano).toString();

const { createApp, ref, computed, onMounted, toRefs } = Vue;

const convertirAFechaLocal = (textoISO) => {
    if (!textoISO) return '';
    const fechaParaArreglar = new Date(textoISO);
    fechaParaArreglar.setMinutes(fechaParaArreglar.getMinutes() - fechaParaArreglar.getTimezoneOffset());
    return fechaParaArreglar.toISOString().slice(0,16);
};

const traducirErrorSupabase = (mensajeError) => {
    if (!mensajeError) return "¡Ups! Tuvimos un pequeño contratiempo al conectarnos. Intenta de nuevo.";
    const msg = mensajeError.toLowerCase();
    if (msg.includes("violates foreign key constraint")) {
        if (msg.includes("empleado")) return "No podemos borrar a tu compañero porque tiene citas agendadas o un historial.";
        if (msg.includes("cliente")) return "¡Cuidado! Este cliente tiene todo su historial con nosotros, no podemos borrarlo de golpe.";
        if (msg.includes("servicio")) return "Ya has brindado este servicio antes, así que su historial está protegido.";
        if (msg.includes("turno")) return "No se puede borrar este turno porque el cliente ya lo pagó.";
        return "Para mantener tus registros perfectos, no podemos eliminar esto porque está conectado con otra información de tu salón.";
    }
    if (msg.includes("duplicate key value violates unique constraint")) return "¡Ojo! Parece que ya tenemos registrado a alguien con este mismo correo, cédula o teléfono.";
    if (msg.includes("violates not-null constraint")) {
        const coindicencia = mensajeError.match(/column "([^"]+)"/i) || mensajeError.match(/columna "([^"]+)"/i);
        const nombreColumna = coindicencia ? coindicencia[1] : "desconocido";
        return `Nos hizo falta llenar el campo "${nombreColumna}". Revisa bien antes de guardar.`;
    }
    return mensajeError;
};

const app = createApp({
    setup() {
        const guardandoDatos = ref(false);
        const errorFormulario = ref('');
        const mensajeExito = ref('');
        const menuLateralAbierto = ref(false);
        const vistaActual = ref('dashboard');
        
        const diapositivaActiva = ref(0);
        const diapositivasAnuncios = ref([
            { tag: 'Promoción', title: 'Mes de la Keratina', desc: 'Aprovecha un 20% de descuento al por mayor en distribuidores autorizados.', bg: 'from-brand-500 to-purple-600', img: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
            { tag: 'Marketing', title: 'Paquetes de Spa para Madres', desc: 'Promociona los paquetes de Spa con un 15% de descuento adicional.', bg: 'from-rose-500 to-orange-500', img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
            { tag: 'Recordatorio Staff', title: 'Capacitación de Colorimetría', desc: 'Recuerda inscribirte en el taller de este viernes a las 09:00 AM.', bg: 'from-blue-600 to-cyan-500', img: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }
        ]);

        const modalActivo = ref(null); 
        const modoEdicion = ref(false);
        const datosDelFormulario = ref({});
        const elementoAEliminar = ref({ table: null, id: null });
        const mostrarContrasena = ref(false);
        const mostrarConfirmacionContrasena = ref(false);

        const plantillaWhatsAppPredeterminada = "Hola [CLIENTE] ✨\n\nTu turno en *Mercy Fason* ha sido agendado exitosamente.\n\n📅 *Fecha:* [FECHA]\n⏰ *Hora:* [HORA]\n💇‍♀️ *Servicios:* [SERVICIOS]\n\n¡Te esperamos! 💖";
        const plantillaWhatsAppGuardada = ref(localStorage.getItem('wsp_template') || plantillaWhatsAppPredeterminada);

        const filtrosBusqueda = ref({
            turno: { search: '', estado: '', fecha: '' },
            pago: { search: '', metodo: '', fechaInicio: '', fechaFin: '' },
            generic: { search: '', estado: '' },
            reportes: { inicio: '', fin: '' }
        });

        const fechaDeHoy = new Date();
        const inicioDeEsteMes = new Date(fechaDeHoy.getFullYear(), fechaDeHoy.getMonth(), 1);
        filtrosBusqueda.value.reportes.inicio = inicioDeEsteMes.toISOString().split('T')[0];
        filtrosBusqueda.value.reportes.fin = fechaDeHoy.toISOString().split('T')[0];

        const cargarInformacionBaseDatos = async () => {
            store.cargandoSistema = true;
            store.mensajeSistema = "Buscando y organizando tu información...";
            try {
                const listadoTablasDescargar = ['usuarios', 'clientes', 'empleados', 'turnos', 'servicios', 'pagos', 'turno_servicios'];
                for (const nombreDeEsaTabla of listadoTablasDescargar) {
                    const { data, error } = await supabase.from(nombreDeEsaTabla).select('*').order('creado_en', { ascending: false });
                    if (error) throw error;
                    store.baseDatos[nombreDeEsaTabla] = data || [];
                }
            } catch (errorAlConectar) {
                console.error("Error al obtener la info:", errorAlConectar);
                store.mensajeSistema = "Hubo un error cargando los datos. Revisa la consola.";
            } finally {
                store.cargandoSistema = false;
            }
        };

        const cerrarSesion = () => {
            store.cerrarSesion();
            vistaActual.value = 'dashboard';
        };

        const irAVista = (nuevaVista) => {
            vistaActual.value = nuevaVista;
            menuLateralAbierto.value = false; 
            filtrosBusqueda.value.generic = { search: '', estado: '' }; 
        };
        
        const limpiarFiltros = (cualFiltro) => { 
            if(cualFiltro === 'turno') filtrosBusqueda.value.turno = { search: '', estado: '', fecha: '' }; 
            if(cualFiltro === 'pago') filtrosBusqueda.value.pago = { search: '', metodo: '', fechaInicio: '', fechaFin: '' };
            if(cualFiltro === 'generic') filtrosBusqueda.value.generic = { search: '', estado: '' };
        };

        const establecerMesActual = () => {
            const hoyAsignar = new Date();
            const primerDiaAsignar = new Date(hoyAsignar.getFullYear(), hoyAsignar.getMonth(), 1);
            filtrosBusqueda.value.reportes.inicio = primerDiaAsignar.toISOString().split('T')[0];
            filtrosBusqueda.value.reportes.fin = hoyAsignar.toISOString().split('T')[0];
        };

        const empleadosActivos = computed(() => store.baseDatos.empleados.filter(e => e.activo !== false));

        const estadisticasGenerales = computed(() => {
            const totalDeIngresos = store.baseDatos.pagos.reduce((acumulado, pagoIndividual) => acumulado + (Number(pagoIndividual.monto) || 0), 0);
            return { ingresosTotales: totalDeIngresos };
        });

        const ultimasAtenciones = computed(() => [...store.baseDatos.turnos].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)).slice(0, 5));

        const datosTablaActual = computed(() => {
            if(['dashboard', 'turnos', 'pagos'].includes(vistaActual.value)) return [];
            return store.baseDatos[vistaActual.value] || [];
        });

        const turnosFiltrados = computed(() => {
            return store.baseDatos.turnos.filter(citaFiltrada => {
                if (store.usuarioActual?.rol === 'staff') {
                    const miPerfilComoEmpleado = store.baseDatos.empleados.find(emp => emp.usuario_id === store.usuarioActual.id);
                    if (!miPerfilComoEmpleado || citaFiltrada.empleado_id !== miPerfilComoEmpleado.id) return false;
                }
                const clienteAsociado = store.baseDatos.clientes.find(cli => cli.id === citaFiltrada.cliente_id);
                const textoParaBuscar = filtrosBusqueda.value.turno.search.toLowerCase();
                const encajaConBusqueda = textoParaBuscar === '' || (clienteAsociado && clienteAsociado.nombre.toLowerCase().includes(textoParaBuscar));
                const encajaConEstado = filtrosBusqueda.value.turno.estado === '' || citaFiltrada.estado === filtrosBusqueda.value.turno.estado;
                const encajaConFecha = filtrosBusqueda.value.turno.fecha === '' || citaFiltrada.fecha_hora.startsWith(filtrosBusqueda.value.turno.fecha);
                return encajaConBusqueda && encajaConEstado && encajaConFecha;
            }).sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
        });

        const pagosFiltrados = computed(() => {
            return store.baseDatos.pagos.filter(pagoEnBuscador => {
                const textoParaBuscar = filtrosBusqueda.value.pago.search.toLowerCase();
                const encajaConMetodo = filtrosBusqueda.value.pago.metodo === '' || pagoEnBuscador.metodo_pago === filtrosBusqueda.value.pago.metodo;
                let estaDentroDeRango = true;
                if (pagoEnBuscador.creado_en) {
                    const fechaDelPago = new Date(pagoEnBuscador.creado_en);
                    if (filtrosBusqueda.value.pago.fechaInicio) {
                        const limiteInferior = new Date(filtrosBusqueda.value.pago.fechaInicio + 'T00:00:00');
                        if (fechaDelPago < limiteInferior) estaDentroDeRango = false;
                    }
                    if (filtrosBusqueda.value.pago.fechaFin) {
                        const limiteSuperior = new Date(filtrosBusqueda.value.pago.fechaFin + 'T23:59:59');
                        if (fechaDelPago > limiteSuperior) estaDentroDeRango = false;
                    }
                }
                let encajaConTexto = true;
                if (textoParaBuscar !== '') {
                    const descripcionTurnoViculado = obtenerDetalleTurno(pagoEnBuscador.turno_id).toLowerCase();
                    const detalleReferencia = (pagoEnBuscador.referencia || '').toLowerCase();
                    encajaConTexto = descripcionTurnoViculado.includes(textoParaBuscar) || detalleReferencia.includes(textoParaBuscar);
                }
                return encajaConTexto && encajaConMetodo && estaDentroDeRango;
            }).sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
        });

        const listaGenericaFiltrada = computed(() => {
            let informacionActual = datosTablaActual.value;
            const loQueBuscaUsuario = (filtrosBusqueda.value.generic.search || '').toLowerCase();
            const filtroEstadoActivo = filtrosBusqueda.value.generic.estado;
            if (loQueBuscaUsuario) {
                informacionActual = informacionActual.filter(r => (r.nombre && r.nombre.toLowerCase().includes(loQueBuscaUsuario)) || (r.email && r.email.toLowerCase().includes(loQueBuscaUsuario)) || (r.descripcion && r.descripcion.toLowerCase().includes(loQueBuscaUsuario)));
            }
            if (filtroEstadoActivo !== '') {
                const verificarSiEsActivo = filtroEstadoActivo === 'activo';
                informacionActual = informacionActual.filter(r => r.activo === undefined ? true : r.activo === verificarSiEsActivo);
            }
            return informacionActual;
        });

        const citasCompletadas = computed(() => {
            return store.baseDatos.turnos
                .filter(citaAnalizada => {
                    if (citaAnalizada.estado !== 'completado') return false;
                    if (modoEdicion.value && datosDelFormulario.value.turno_id === citaAnalizada.id) return true;
                    return !store.baseDatos.pagos.some(p => p.turno_id === citaAnalizada.id);
                }).sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
        });

        const datosReporte = computed(() => {
            const limiteInicio = filtrosBusqueda.value.reportes.inicio ? new Date(filtrosBusqueda.value.reportes.inicio + 'T00:00:00') : new Date(0);
            const limiteFinal = filtrosBusqueda.value.reportes.fin ? new Date(filtrosBusqueda.value.reportes.fin + 'T23:59:59') : new Date();

            const abonosDelPeriodo = store.baseDatos.pagos.filter(abono => {
                const cuandoSePago = new Date(abono.creado_en);
                return cuandoSePago >= limiteInicio && cuandoSePago <= limiteFinal;
            });
            const atencionesDelPeriodo = store.baseDatos.turnos.filter(atencion => {
                const cuandoSeAtendio = new Date(atencion.fecha_hora);
                return cuandoSeAtendio >= limiteInicio && cuandoSeAtendio <= limiteFinal && atencion.estado === 'completado';
            });

            const totalDineroIngresado = abonosDelPeriodo.reduce((sumatoria, abono) => sumatoria + Number(abono.monto), 0);

            const cajaDeMetodos = {};
            abonosDelPeriodo.forEach(abono => cajaDeMetodos[abono.metodo_pago] = (cajaDeMetodos[abono.metodo_pago] || 0) + Number(abono.monto));
            const metricasDeMetodos = Object.keys(cajaDeMetodos).map(nombre => ({ nombre, monto: cajaDeMetodos[nombre], porcentaje: totalDineroIngresado > 0 ? (cajaDeMetodos[nombre] / totalDineroIngresado) * 100 : 0 })).sort((a, b) => b.monto - a.monto);

            const cajaDeEmpleados = {};
            store.baseDatos.empleados.forEach(emp => cajaDeEmpleados[emp.id] = { nombre: emp.nombre, turnos: 0, ingresos: 0, comision: 0, porcentaje: emp.porcentaje_comision || 0 });
            atencionesDelPeriodo.forEach(atencion => { if(cajaDeEmpleados[atencion.empleado_id]) cajaDeEmpleados[atencion.empleado_id].turnos += 1; });
            abonosDelPeriodo.forEach(abono => {
                const atencionDelAbono = store.baseDatos.turnos.find(t => t.id === abono.turno_id);
                if (atencionDelAbono && cajaDeEmpleados[atencionDelAbono.empleado_id]) {
                    const datosParaLiquidacion = cajaDeEmpleados[atencionDelAbono.empleado_id];
                    const montoDelAbono = Number(abono.monto) || 0;
                    const otrosAdicionales = Number(abono.otros_pagos) || 0;
                    datosParaLiquidacion.ingresos += montoDelAbono;
                    datosParaLiquidacion.comision += ((montoDelAbono - otrosAdicionales) * (datosParaLiquidacion.porcentaje / 100));
                }
            });
            const metricasDeEmpleados = Object.values(cajaDeEmpleados).filter(d => d.turnos > 0 || d.ingresos > 0).sort((a, b) => b.ingresos - a.ingresos);
            
            const idsDeTurnosAnalizados = atencionesDelPeriodo.map(a => a.id);
            const cajaDeServicios = {};
            store.baseDatos.turno_servicios.forEach(asignacion => {
                if (idsDeTurnosAnalizados.includes(asignacion.turno_id)) {
                    if (!cajaDeServicios[asignacion.servicio_id]) {
                        const sBase = store.baseDatos.servicios.find(s => s.id === asignacion.servicio_id);
                        cajaDeServicios[asignacion.servicio_id] = { nombre: sBase ? sBase.nombre : 'Servicio Eliminado', cantidad: 0, ingresos: 0 };
                    }
                    cajaDeServicios[asignacion.servicio_id].cantidad += 1;
                    let cuantoCostaba = Number(asignacion.precio_cobrado);
                    if (isNaN(cuantoCostaba) || cuantoCostaba === 0) {
                        const sBase = store.baseDatos.servicios.find(s => s.id === asignacion.servicio_id);
                        cuantoCostaba = sBase ? Number(sBase.precio_base) : 0;
                    }
                    cajaDeServicios[asignacion.servicio_id].ingresos += cuantoCostaba;
                }
            });
            const rankingServiciosExitosos = Object.values(cajaDeServicios).sort((a, b) => b.cantidad - a.cantidad);

            return { 
                pagos: abonosDelPeriodo, turnos: atencionesDelPeriodo, totalIngresos: totalDineroIngresado, 
                ticketPromedio: abonosDelPeriodo.length > 0 ? (totalDineroIngresado / abonosDelPeriodo.length) : 0, 
                metodos: metricasDeMetodos, empleados: metricasDeEmpleados, 
                maxTurnosEmp: metricasDeEmpleados.length > 0 ? Math.max(...metricasDeEmpleados.map(e => e.turnos)) : 1, 
                serviciosDemanda: rankingServiciosExitosos, 
                maxServiciosDemanda: rankingServiciosExitosos.length > 0 ? Math.max(...rankingServiciosExitosos.map(s => s.cantidad)) : 1 
            };
        });

        const obtenerNombreRegistro = (queTablaBuscar, elIdBuscado) => {
            const registroEncontrado = store.baseDatos[queTablaBuscar].find(r => r.id === elIdBuscado);
            return registroEncontrado ? registroEncontrado.nombre : 'Desconocido';
        };

        const obtenerServiciosDeTurno = (elIdDelTurnoEnCuestion) => {
            return store.baseDatos.turno_servicios.filter(r => r.turno_id === elIdDelTurnoEnCuestion).map(r => {
                const sbd = store.baseDatos.servicios.find(s => s.id === r.servicio_id);
                return { id: r.servicio_id, nombre: sbd ? sbd.nombre : 'Eliminado' };
            });
        };

        const formatearFechaHora = (laStringDelaFecha) => laStringDelaFecha ? new Date(laStringDelaFecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const obtenerDetalleTurno = (idTurno) => {
            const cita = store.baseDatos.turnos.find(t => t.id === idTurno);
            return cita ? `${obtenerNombreRegistro('clientes', cita.cliente_id)} - ${formatearFechaHora(cita.fecha_hora)}` : 'Turno Desconocido';
        };

        const obtenerEstiloEstado = (etiquetaDelEstado) => {
            const prefijo = "px-2 py-1 rounded text-xs font-medium capitalize ";
            switch(etiquetaDelEstado) {
                case 'pendiente': return prefijo + "bg-yellow-100 text-yellow-800";
                case 'confirmado': return prefijo + "bg-blue-100 text-blue-800";
                case 'en_proceso': return prefijo + "bg-purple-100 text-purple-800";
                case 'completado': return prefijo + "bg-emerald-100 text-emerald-800";
                case 'cancelado': return prefijo + "bg-red-100 text-red-800";
                default: return prefijo + "bg-slate-100 text-slate-800";
            }
        };

        const turnoYaEstaPagado = (idVerificarSiSePago) => store.baseDatos.pagos.some(ticket => ticket.turno_id === idVerificarSiSePago);
        
        const vistaTieneCampo = (nombreColumna) => {
            if(['dashboard', 'turnos', 'pagos', 'reportes'].includes(vistaActual.value)) return false;
            const columnasPorVentana = {
                'clientes': ['telefono', 'email', 'cedula', 'direccion'],
                'empleados': ['telefono', 'email', 'especialidad', 'rol', 'activo', 'cedula', 'direccion'],
                'servicios': ['precio_base', 'duracion_minutos', 'activo'],
                'usuarios': ['email', 'telefono', 'rol', 'activo']
            };
            if (columnasPorVentana[vistaActual.value] && columnasPorVentana[vistaActual.value].includes(nombreColumna)) return true;
            return (datosTablaActual.value && datosTablaActual.value.length > 0) ? datosTablaActual.value[0][nombreColumna] !== undefined : false;
        };

        const exportarArchivo = (laVistaDeOrigen, conCualFormato) => {
            const info = laVistaDeOrigen === 'turnos' ? turnosFiltrados.value : listaGenericaFiltrada.value;
            if (info.length === 0) return;

            let celdasPreparadasParaExcel = [];
            if (laVistaDeOrigen === 'turnos') {
                celdasPreparadasParaExcel = info.map(r => ({
                    "Cliente": obtenerNombreRegistro('clientes', r.cliente_id), "Atendido por": obtenerNombreRegistro('empleados', r.empleado_id),
                    "Fecha y Hora": formatearFechaHora(r.fecha_hora), "Estado": (r.estado || '').replace(/_/g, ' ').toUpperCase(),
                    "Servicios": obtenerServiciosDeTurno(r.id).map(s => s.nombre).join(' | ') || 'Sin servicios', "Notas": r.notas_internas || 'N/A'
                }));
            } else if (laVistaDeOrigen === 'servicios') {
                celdasPreparadasParaExcel = info.map(r => ({ "Servicio": r.nombre, "Descripción": r.descripcion || 'Sin descripción', "Precio Base": Number(r.precio_base) || 0, "Duración (min)": r.duracion_minutos || 0, "Estado": r.activo ? 'Activo' : 'Inactivo' }));
            } else if (laVistaDeOrigen === 'clientes') {
                celdasPreparadasParaExcel = info.map(r => ({ "Cliente": r.nombre, "Cédula": r.cedula || '-', "Teléfono": r.telefono || '-', "Email": r.email || '-', "Dirección": r.direccion || '-', "Notas": r.notas || '-' }));
            } else if (laVistaDeOrigen === 'empleados') {
                 celdasPreparadasParaExcel = info.map(r => ({ "Empleado": r.nombre, "Cédula": r.cedula || '-', "Email": r.email || '-', "Teléfono": r.telefono || '-', "Dirección": r.direccion || '-', "Especialidad": r.especialidad || '-', "Comisión Serv.": r.porcentaje_comision || 0, "Comisión Prod.": r.porcentaje_comision_producto || 0, "Estado": r.activo ? 'Activo' : 'Inactivo' }));
            } else if (laVistaDeOrigen === 'usuarios') {
                 celdasPreparadasParaExcel = info.map(r => ({ "Usuario": r.nombre, "Email": r.email, "Rol": r.rol, "Estado": r.activo ? 'Activo' : 'Inactivo' }));
            }

            const objetoHojaLibro = XLSX.utils.json_to_sheet(celdasPreparadasParaExcel);
            const nombreArchivo = `Exportacion_${laVistaDeOrigen}_${new Date().toISOString().split('T')[0]}`;

            if (conCualFormato === 'excel') {
                const nuevoLibro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(nuevoLibro, objetoHojaLibro, laVistaDeOrigen.toUpperCase()); XLSX.writeFile(nuevoLibro, `${nombreArchivo}.xlsx`);
            } else if (conCualFormato === 'csv') {
                const codificacionCsv = XLSX.utils.sheet_to_csv(objetoHojaLibro);
                const tag = document.createElement("a");
                tag.href = URL.createObjectURL(new Blob(['\uFEFF' + codificacionCsv], { type: 'text/csv;charset=utf-8;' }));
                tag.download = `${nombreArchivo}.csv`; tag.click();
            }
        };

        const descargarPagosCSV = () => {
            if (pagosFiltrados.value.length === 0) return;
            let csv = '\uFEFFFecha,Cliente y Turno,Monto Total,Servicios,Otros,Metodo de Pago,Referencia\n';
            pagosFiltrados.value.forEach(p => { csv += `${new Date(p.creado_en).toLocaleDateString('es-ES')},"${obtenerDetalleTurno(p.turno_id)}",${p.monto},${p.monto-(p.otros_pagos||0)},${p.otros_pagos||0},${p.metodo_pago},"${p.referencia || ''}"\n`; });
            const tag = document.createElement("a"); tag.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); tag.download = `Reporte_Pagos_${new Date().toISOString().split('T')[0]}.csv`; tag.click();
        };

        const descargarPagosExcel = () => {
            if (pagosFiltrados.value.length === 0) return;
            const arr = pagosFiltrados.value.map(p => ({ "Fecha": new Date(p.creado_en).toLocaleDateString('es-ES'), "Turno": obtenerDetalleTurno(p.turno_id), "Monto Total": Number(p.monto)||0, "Servicios": (Number(p.monto)||0)-(Number(p.otros_pagos)||0), "Otros": Number(p.otros_pagos)||0, "Método": (p.metodo_pago||'').toUpperCase(), "Referencia": p.referencia||'N/A' }));
            const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(arr), "Pagos"); XLSX.writeFile(libro, `Reporte_Pagos_${new Date().toISOString().split('T')[0]}.xlsx`);
        };

        const calcularTotalPago = () => {
            if (!datosDelFormulario.value.turno_id) return;
            let contadorMonto = 0;
            store.baseDatos.turno_servicios.filter(a => a.turno_id === datosDelFormulario.value.turno_id).forEach(a => {
                if (a.precio_cobrado) { contadorMonto += Number(a.precio_cobrado); } 
                else {
                    const perfil = store.baseDatos.servicios.find(s => s.id === a.servicio_id);
                    if (perfil) contadorMonto += Number(perfil.precio_base);
                }
            });
            datosDelFormulario.value.monto_servicios = contadorMonto;
            datosDelFormulario.value.monto = contadorMonto + (Number(datosDelFormulario.value.otros_pagos) || 0);
        };

        const enviarRecordatorioWhatsApp = (cita) => {
            const cliente = store.baseDatos.clientes.find(c => c.id === cita.cliente_id);
            if (!cliente || !cliente.telefono) return;
            let numero = cliente.telefono.replace(/\D/g, '');
            if (numero.length === 10 && numero.startsWith('0')) numero = '593' + numero.substring(1);
            
            const fecha = new Date(cita.fecha_hora);
            let msj = plantillaWhatsAppGuardada.value.replace(/\[CLIENTE\]/g, cliente.nombre).replace(/\[FECHA\]/g, fecha.toLocaleDateString('es-ES')).replace(/\[HORA\]/g, fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute:'2-digit' })).replace(/\[SERVICIOS\]/g, obtenerServiciosDeTurno(cita.id).map(s => s.nombre).join(', ') || 'Por confirmar');
            window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msj)}`, '_blank');
        };

        const abrirVentanaEmergente = (tipo, registroPreexistente = null) => {
            modalActivo.value = tipo; modoEdicion.value = !!registroPreexistente;
            errorFormulario.value = ''; mensajeExito.value = ''; mostrarContrasena.value = false; mostrarConfirmacionContrasena.value = false;
            
            if (registroPreexistente) {
                datosDelFormulario.value = { ...registroPreexistente };
                if(tipo === 'turno') {
                    if (datosDelFormulario.value.fecha_hora) datosDelFormulario.value.fecha_hora = convertirAFechaLocal(datosDelFormulario.value.fecha_hora);
                    datosDelFormulario.value.servicios_seleccionados = store.baseDatos.turno_servicios.filter(r => r.turno_id === registroPreexistente.id).map(r => r.servicio_id);
                }
                if(tipo === 'pago') datosDelFormulario.value.monto_servicios = Number(registroPreexistente.monto) - (Number(registroPreexistente.otros_pagos) || 0);
            } else {
                if(tipo === 'cliente') datosDelFormulario.value = { nombre: '', cedula: '', telefono: '', email: '', direccion: '', notas: '' };
                else if(tipo === 'empleado') datosDelFormulario.value = { nombre: '', cedula: '', telefono: '', email: '', direccion: '', especialidad: '', porcentaje_comision: 30, porcentaje_comision_producto: 10, activo: true };
                else if(tipo === 'usuario') datosDelFormulario.value = { nombre: '', email: '', telefono: '', passwordapp: '', confirm_password: '', rol: 'recepcion', activo: true };
                else if(tipo === 'servicio') datosDelFormulario.value = { nombre: '', descripcion: '', precio_base: 0, duracion_minutos: 30, activo: true };
                else if(tipo === 'turno') {
                    datosDelFormulario.value = { cliente_id: '', empleado_id: '', estado: 'pendiente', fecha_hora: convertirAFechaLocal(new Date().toISOString()), notas_internas: '', servicios_seleccionados: [] };
                    if(store.usuarioActual?.rol === 'staff') {
                        const miEmp = store.baseDatos.empleados.find(e => e.usuario_id === store.usuarioActual.id);
                        if(miEmp) datosDelFormulario.value.empleado_id = miEmp.id;
                    }
                } 
                else if(tipo === 'pago') datosDelFormulario.value = { turno_id: '', monto: 0, monto_servicios: 0, otros_pagos: 0, metodo_pago: 'efectivo', referencia: '' };
                else if(tipo === 'configWsp') datosDelFormulario.value = { wspTemplate: plantillaWhatsAppGuardada.value };
            }
        };

        const insertarEtiqueta = (etiqueta) => {
            const dom = document.getElementById('wspTextarea');
            if (dom) {
                const pos = dom.selectionStart;
                const txt = datosDelFormulario.value.wspTemplate || '';
                datosDelFormulario.value.wspTemplate = txt.substring(0, pos) + etiqueta + txt.substring(dom.selectionEnd);
                setTimeout(() => { dom.focus(); dom.selectionEnd = pos + etiqueta.length; }, 10);
            } else { datosDelFormulario.value.wspTemplate = (datosDelFormulario.value.wspTemplate || '') + etiqueta; }
        };

        const cerrarVentanaEmergente = (forzar = false) => {
            if(guardandoDatos.value && !forzar) return;
            modalActivo.value = null; datosDelFormulario.value = {}; errorFormulario.value = ''; mensajeExito.value = '';
        };

        const procesarServiciosDeCita = async (idTurno, arregloIds) => {
            await supabase.from('turno_servicios').delete().eq('turno_id', idTurno);
            if(arregloIds && arregloIds.length > 0) {
                const insert = arregloIds.map(idSrv => {
                    const sb = store.baseDatos.servicios.find(s => s.id === idSrv);
                    return { turno_id: idTurno, servicio_id: idSrv, precio_cobrado: sb ? sb.precio_base : 0 };
                });
                await supabase.from('turno_servicios').insert(insert);
            }
        };

        const guardarFormulario = async () => {
            guardandoDatos.value = true; errorFormulario.value = '';
            try {
                if (modalActivo.value === 'configWsp') {
                    plantillaWhatsAppGuardada.value = datosDelFormulario.value.wspTemplate;
                    localStorage.setItem('wsp_template', datosDelFormulario.value.wspTemplate);
                    mensajeExito.value = '¡Tu plantilla de WhatsApp ha quedado genial!';
                    modalActivo.value = 'success'; return; 
                }

                const mapaTablas = { 'turno': 'turnos', 'cliente': 'clientes', 'empleado': 'empleados', 'usuario': 'usuarios', 'servicio': 'servicios', 'pago': 'pagos' };
                const tablaDestino = mapaTablas[modalActivo.value];
                const dataEnvio = { ...datosDelFormulario.value };
                let serviciosPendientes = [];
                
                for (const prop in dataEnvio) { if (typeof dataEnvio[prop] === 'string') dataEnvio[prop] = dataEnvio[prop].trim(); }
                if ('nombre' in dataEnvio && !dataEnvio.nombre) { errorFormulario.value = "Falta el nombre."; return; }
                if (dataEnvio.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dataEnvio.email)) { errorFormulario.value = "Correo inválido."; return; }
                if (dataEnvio.telefono) {
                    dataEnvio.telefono = dataEnvio.telefono.replace(/\D/g, '');
                    if (!/^[0-9]{9,15}$/.test(dataEnvio.telefono)) { errorFormulario.value = "Teléfono inválido."; return; }
                }
                if (dataEnvio.cedula) {
                    dataEnvio.cedula = dataEnvio.cedula.replace(/\D/g, '');
                    if (!/^(\d{10}|\d{13})$/.test(dataEnvio.cedula)) { errorFormulario.value = "Cédula inválida."; return; }
                }

                if(modalActivo.value === 'usuario') {
                    if (!dataEnvio.email || !dataEnvio.telefono || !dataEnvio.rol) { errorFormulario.value = "Faltan datos."; return; }
                    if (!modoEdicion.value) {
                        if (dataEnvio.passwordapp !== dataEnvio.confirm_password) { errorFormulario.value = "Contraseñas no coinciden."; return; }
                        dataEnvio.passwordapp = encriptarContrasena(dataEnvio.passwordapp);
                    } else {
                        if (dataEnvio.nueva_password) {
                            if (dataEnvio.nueva_password !== dataEnvio.confirm_password) { errorFormulario.value = "Contraseñas no coinciden."; return; }
                            dataEnvio.passwordapp = encriptarContrasena(dataEnvio.nueva_password);
                        }
                        delete dataEnvio.nueva_password;
                    }
                    delete dataEnvio.confirm_password;
                }
                
                if(modalActivo.value === 'turno') {
                    if(dataEnvio.fecha_hora) dataEnvio.fecha_hora = new Date(dataEnvio.fecha_hora).toISOString();
                    serviciosPendientes = dataEnvio.servicios_seleccionados || [];
                    delete dataEnvio.servicios_seleccionados; 
                }
                
                if(modalActivo.value === 'pago') {
                    dataEnvio.monto = (Number(dataEnvio.monto_servicios) || 0) + (Number(dataEnvio.otros_pagos) || 0);
                    if(!modoEdicion.value) dataEnvio.registrado_por = store.usuarioActual?.id;
                    delete dataEnvio.monto_servicios; 
                }

                if (modoEdicion.value) {
                    const { id, ...dataSinId } = dataEnvio;
                    const { error } = await supabase.from(tablaDestino).update(dataSinId).eq('id', id);
                    if (error) throw error;
                    if (modalActivo.value === 'turno') await procesarServiciosDeCita(id, serviciosPendientes);
                } else {
                    const { data, error } = await supabase.from(tablaDestino).insert([dataEnvio]).select();
                    if (error) throw error;
                    if (modalActivo.value === 'turno' && data && data.length > 0) { await procesarServiciosDeCita(data[0].id, serviciosPendientes); }
                }
                
                await cargarInformacionBaseDatos();
                if (!modoEdicion.value && modalActivo.value === 'turno' && dataEnvio.cliente_id && store.baseDatos.turnos.length > 0) {
                    enviarRecordatorioWhatsApp(store.baseDatos.turnos[0]);
                }
                mensajeExito.value = `¡Guardado exitosamente!`; modalActivo.value = 'success';
            } catch(errorDesdeSupabase) {
                errorFormulario.value = traducirErrorSupabase(errorDesdeSupabase.message);
            } finally { guardandoDatos.value = false; }
        };

        const pedirConfirmacionEliminar = (tabla, id) => { elementoAEliminar.value = { table: tabla, id: id }; modalActivo.value = 'delete'; errorFormulario.value = ''; };

        const ejecutarEliminacion = async () => {
            guardandoDatos.value = true; errorFormulario.value = '';
            try {
                const { error } = await supabase.from(elementoAEliminar.value.table).delete().eq('id', elementoAEliminar.value.id);
                if (error) throw error;
                await cargarInformacionBaseDatos();
                mensajeExito.value = '¡Eliminado correctamente!'; modalActivo.value = 'success';
            } catch (err) { errorFormulario.value = traducirErrorSupabase(err.message); } finally { guardandoDatos.value = false; }
        };

        onMounted(() => { setInterval(() => { if (vistaActual.value === 'dashboard') diapositivaActiva.value = (diapositivaActiva.value + 1) % diapositivasAnuncios.value.length; }, 5000); });

        // Gracias a toRefs, exportamos todas las variables del Store de manera que el HTML no se dé cuenta del cambio
        return {
            ...toRefs(store), guardandoDatos, errorFormulario, mensajeExito, menuLateralAbierto, vistaActual, diapositivaActiva, diapositivasAnuncios, modalActivo, modoEdicion, datosDelFormulario, elementoAEliminar, mostrarContrasena, mostrarConfirmacionContrasena, filtrosBusqueda, plantillaWhatsAppGuardada, empleadosActivos, estadisticasGenerales, ultimasAtenciones, datosTablaActual, turnosFiltrados, pagosFiltrados, listaGenericaFiltrada, citasCompletadas, datosReporte,
            cargarInformacionBaseDatos, cerrarSesion, irAVista, limpiarFiltros, establecerMesActual, obtenerNombreRegistro, obtenerServiciosDeTurno, formatearFechaHora, obtenerEstiloEstado, obtenerDetalleTurno, turnoYaEstaPagado, vistaTieneCampo, exportarArchivo, descargarPagosCSV, descargarPagosExcel, calcularTotalPago, enviarRecordatorioWhatsApp, abrirVentanaEmergente, insertarEtiqueta, cerrarVentanaEmergente, guardarFormulario, pedirConfirmacionEliminar, ejecutarEliminacion
        };
    }
});

app.component('login-view', LoginView);
app.mount('#app');