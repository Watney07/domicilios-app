import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { api, setToken } from './api.js'
import { decodeJwtPayload } from './jwt.js'

function App() {
  const [mode, setMode] = useState('login') // login | register | app
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [session, setSession] = useState({
    token: localStorage.getItem('token') || '',
    usuario: null,
  })

  const role = session.usuario?.rol || null

  useEffect(() => {
    const token = localStorage.getItem('token') || ''
    if (!token) return

    const payload = decodeJwtPayload(token)
    if (payload && payload.rol) {
      setSession((s) => ({ ...s, token, usuario: payload }))
      setMode('app')
      // Aun asi validamos con el backend (firma/expiracion).
      api('/api/auth/me')
        .then((data) => {
          setSession((s) => ({ ...s, usuario: data.usuario }))
        })
        .catch(() => {
          setToken('')
          setSession({ token: '', usuario: null })
          setMode('login')
        })
    }
  }, [])

  const onLogout = () => {
    setToken('')
    setSession({ token: '', usuario: null })
    setMode('login')
  }

  const header = useMemo(() => {
    const name = session.usuario?.nombre || session.usuario?.email || ''
    return { name, role }
  }, [session.usuario, role])

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">D</div>
          <div>
            <div className="brandName">Proyecto Domicilios</div>
            <div className="brandTag">React + Express + MySQL</div>
          </div>
        </div>
        <div className="topbarRight">
          {header.role ? <span className="pill">{header.role}</span> : null}
          {header.name ? <span className="muted">{header.name}</span> : null}
          {mode === 'app' ? (
            <button className="btn" onClick={onLogout}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </header>

      <main className="content">
        {error ? <div className="alert">{error}</div> : null}

        {mode === 'login' ? (
          <Login
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onSuccess={(token, usuario) => {
              setToken(token)
              setSession({ token, usuario })
              setMode('app')
            }}
            onGoRegister={() => {
              setError('')
              setMode('register')
            }}
          />
        ) : null}

        {mode === 'register' ? (
          <Register
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onGoLogin={() => {
              setError('')
              setMode('login')
            }}
          />
        ) : null}

        {mode === 'app' ? <RoleApp role={role} setError={setError} /> : null}
      </main>
    </div>
  )
}

export default App

function Login({ busy, setBusy, setError, onSuccess, onGoRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('password') // password | 2fa

  const onLogin = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password } })
      setTempToken(data.tempToken)
      setStage('2fa')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onVerify = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api('/api/auth/verify-2fa', { method: 'POST', body: { tempToken, code } })
      onSuccess(data.token, data.usuario)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Iniciar sesión</h2>
      <p className="muted">
        Paso 1: email y contraseña. Paso 2: código de tu Authenticator.
      </p>

      {stage === 'password' ? (
        <form onSubmit={onLogin} className="form">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@test.com" />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <div className="row">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" className="btn" onClick={onGoRegister} disabled={busy}>
              Crear cuenta
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onVerify} className="form">
          <label>
            Código 2FA (6 dígitos)
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </label>
          <div className="row">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Verificando...' : 'Verificar 2FA'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setStage('password')
                setCode('')
                setTempToken('')
              }}
              disabled={busy}
            >
              Volver
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function Register({ busy, setBusy, setError, onGoLogin }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState('cliente')
  const [qrCode, setQrCode] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')

  const onRegister = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: { nombre, email, password, rol },
      })
      setQrCode(data.qrCode)
      setOtpauthUrl(data.otpauth_url)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Crear cuenta</h2>
      <p className="muted">Escanea el QR una sola vez en tu Authenticator y luego usa login normal.</p>

      <form onSubmit={onRegister} className="form">
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan" />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@test.com" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        <label>
          Rol (para pruebas)
          <select value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="cliente">cliente</option>
            <option value="repartidor">repartidor</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <div className="row">
          <button className="btn primary" disabled={busy}>
            {busy ? 'Creando...' : 'Registrar'}
          </button>
          <button type="button" className="btn" onClick={onGoLogin} disabled={busy}>
            Volver a login
          </button>
        </div>
      </form>

      {qrCode ? (
        <div className="qrBox">
          <div className="qrTitle">Tu QR de 2FA</div>
          <img className="qrImg" src={qrCode} alt="QR 2FA" />
          <div className="muted small">Si tu app no escanea, usa el link:</div>
          <code className="codeBlock">{otpauthUrl}</code>
        </div>
      ) : null}
    </section>
  )
}

function RoleApp({ role, setError }) {
  if (role === 'admin') return <AdminView setError={setError} />
  if (role === 'cliente') return <ClienteView setError={setError} />
  if (role === 'repartidor') return <RepartidorView setError={setError} />
  return (
    <section className="card">
      <h2>Rol no reconocido</h2>
      <p className="muted">Revisa el rol en la tabla roles y en el JWT.</p>
    </section>
  )
}

function AdminView({ setError }) {
  const [productos, setProductos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [assign, setAssign] = useState({ id_pedido: '', id_repartidor: '' })

  const load = async () => {
    setError('')
    try {
      const [p, u, pe] = await Promise.all([
        api('/api/productos'),
        api('/api/usuarios'),
        api('/api/pedidos'),
      ])
      setProductos(p)
      setUsuarios(u)
      setPedidos(pe)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section className="grid">
      <div className="card">
        <div className="row spread">
          <h2>Admin</h2>
          <button className="btn" onClick={load}>
            Recargar
          </button>
        </div>
        <p className="muted">Inventario, usuarios y pedidos.</p>
      </div>

      <DataCard
        title="Productos"
        columns={[
          ['id_producto', 'ID'],
          ['nombre', 'Nombre'],
          ['precio', 'Precio'],
          ['stock', 'Stock'],
        ]}
        rows={productos}
      />

      <DataCard
        title="Usuarios"
        columns={[
          ['id_usuario', 'ID'],
          ['nombre', 'Nombre'],
          ['email', 'Email'],
          ['rol', 'Rol'],
        ]}
        rows={usuarios}
      />

      <div className="card">
        <h3>Asignar pedido a repartidor</h3>
        <div className="form">
          <label>
            id_pedido
            <input
              value={assign.id_pedido}
              onChange={(e) => setAssign((a) => ({ ...a, id_pedido: e.target.value }))}
              placeholder="1"
            />
          </label>
          <label>
            Repartidor
            <select
              value={assign.id_repartidor}
              onChange={(e) => setAssign((a) => ({ ...a, id_repartidor: e.target.value }))}
            >
              <option value="">Selecciona...</option>
              {usuarios
                .filter((u) => u.rol === 'repartidor')
                .map((u) => (
                  <option key={u.id_usuario} value={u.id_usuario}>
                    {u.nombre} (#{u.id_usuario})
                  </option>
                ))}
            </select>
          </label>
          <button
            className="btn primary"
            onClick={async () => {
              setError('')
              try {
                await api(`/api/pedidos/${assign.id_pedido}/asignar`, {
                  method: 'PUT',
                  body: { id_repartidor: assign.id_repartidor },
                })
                await load()
              } catch (err) {
                setError(err.message)
              }
            }}
            disabled={!assign.id_pedido || !assign.id_repartidor}
          >
            Asignar
          </button>
        </div>
      </div>

      <DataCard
        title="Pedidos"
        columns={[
          ['id_pedido', 'Pedido'],
          ['cliente_nombre', 'Cliente'],
          ['repartidor_nombre', 'Repartidor'],
          ['estado', 'Estado'],
          ['total', 'Total'],
        ]}
        rows={pedidos}
      />
    </section>
  )
}

function ClienteView({ setError }) {
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [items, setItems] = useState([]) // [{id_producto,cantidad}]
  const [direccion, setDireccion] = useState('')

  const load = async () => {
    setError('')
    try {
      const [p, pe] = await Promise.all([api('/api/productos'), api('/api/pedidos')])
      setProductos(p)
      setPedidos(pe)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const addItem = (id_producto) => {
    setItems((prev) => {
      const found = prev.find((x) => x.id_producto === id_producto)
      if (found) return prev.map((x) => (x.id_producto === id_producto ? { ...x, cantidad: x.cantidad + 1 } : x))
      return [...prev, { id_producto, cantidad: 1 }]
    })
  }

  const onCrearPedido = async () => {
    setError('')
    try {
      await api('/api/pedidos', { method: 'POST', body: { direccion_entrega: direccion, items } })
      setItems([])
      setDireccion('')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="grid">
      <div className="card">
        <div className="row spread">
          <h2>Cliente</h2>
          <button className="btn" onClick={load}>
            Recargar
          </button>
        </div>
        <p className="muted">Ver productos y crear pedidos.</p>
      </div>

      <div className="card">
        <h3>Productos</h3>
        <div className="list">
          {productos.map((p) => (
            <div key={p.id_producto} className="listRow">
              <div>
                <div className="strong">{p.nombre}</div>
                <div className="muted small">${p.precio}</div>
              </div>
              <button className="btn small" onClick={() => addItem(p.id_producto)}>
                Agregar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Carrito</h3>
        <label className="block">
          Dirección entrega (opcional)
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle 123" />
        </label>
        <div className="muted small">Items: {items.length ? JSON.stringify(items) : 'vacío'}</div>
        <div className="row">
          <button className="btn primary" onClick={onCrearPedido} disabled={!items.length}>
            Crear pedido
          </button>
          <button className="btn" onClick={() => setItems([])} disabled={!items.length}>
            Vaciar
          </button>
        </div>
      </div>

      <DataCard
        title="Mis pedidos"
        columns={[
          ['id_pedido', 'Pedido'],
          ['estado', 'Estado'],
          ['total', 'Total'],
          ['fecha_pedido', 'Fecha'],
        ]}
        rows={pedidos}
      />
    </section>
  )
}

function RepartidorView({ setError }) {
  const [pedidos, setPedidos] = useState([])
  const [estados, setEstados] = useState([])
  const [update, setUpdate] = useState({ id_pedido: '', id_estado: '' })

  const load = async () => {
    setError('')
    try {
      const [pe, es] = await Promise.all([api('/api/pedidos'), api('/api/estados-pedido')])
      setPedidos(pe)
      setEstados(es)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onCambiarEstado = async () => {
    setError('')
    try {
      await api(`/api/pedidos/${update.id_pedido}/estado`, {
        method: 'PUT',
        body: { id_estado: update.id_estado },
      })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="grid">
      <div className="card">
        <div className="row spread">
          <h2>Repartidor</h2>
          <button className="btn" onClick={load}>
            Recargar
          </button>
        </div>
        <p className="muted">Ver pedidos asignados y cambiar estado.</p>
      </div>

      <DataCard
        title="Pedidos asignados"
        columns={[
          ['id_pedido', 'Pedido'],
          ['cliente_nombre', 'Cliente'],
          ['direccion_entrega', 'Dirección'],
          ['estado', 'Estado'],
          ['total', 'Total'],
        ]}
        rows={pedidos}
      />

      <div className="card">
        <h3>Cambiar estado</h3>
        <div className="form">
          <label>
            id_pedido
            <input value={update.id_pedido} onChange={(e) => setUpdate((u) => ({ ...u, id_pedido: e.target.value }))} placeholder="1" />
          </label>
          <label>
            Nuevo estado
            <select value={update.id_estado} onChange={(e) => setUpdate((u) => ({ ...u, id_estado: e.target.value }))}>
              <option value="">Selecciona...</option>
              {estados.map((e) => (
                <option key={e.id_estado} value={e.id_estado}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={onCambiarEstado} disabled={!update.id_pedido || !update.id_estado}>
            Actualizar
          </button>
        </div>
      </div>
    </section>
  )
}

function DataCard({ title, columns, rows }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="table">
        <Table columns={columns} rows={rows} />
      </div>
    </div>
  )
}

function Table({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return <div className="muted small">Sin datos</div>
  }

  const cols = columns && columns.length ? columns : Object.keys(rows[0]).map((k) => [k, k])

  return (
    <div className="tblWrap">
      <table className="tbl">
        <thead>
          <tr>
            {cols.map(([key, label]) => (
              <th key={key}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id || r.id_pedido || r.id_usuario || r.id_producto || idx}>
              {cols.map(([key]) => (
                <td key={key}>{String(r[key] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
