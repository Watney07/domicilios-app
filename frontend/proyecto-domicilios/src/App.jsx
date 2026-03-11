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
          <div className="brandMark"><img src="https://ih1.redbubble.net/image.355049251.4252/raf,360x360,075,t,fafafa:ca443f4786.u4.jpg" width={35} height={35}></img></div>
          <div>
            <div className="brandName">Condiments Kings</div>
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
  const [invoice, setInvoice] = useState({ open: false, loading: false, data: null })
  const [customCategoria, setCustomCategoria] = useState('')
  const [productForm, setProductForm] = useState({
    id_producto: '',
    nombre: '',
    descripcion: '',
    categoria: '',
    imagen_url: '',
    precio: '',
    stock: '',
  })

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

  const productCategories = Array.from(
    new Set(productos.map((p) => String(p.categoria || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  const openInvoice = async (id_pedido) => {
    setError('')
    setInvoice({ open: true, loading: true, data: null })
    try {
      const data = await api(`/api/pedidos/${id_pedido}`)
      setInvoice({ open: true, loading: false, data })
    } catch (err) {
      setInvoice({ open: false, loading: false, data: null })
      setError(err.message)
    }
  }

  const pedidosSinAsignar = pedidos.filter((p) => !p.id_repartidor)

  return (
    <section className="grid">
      <div className="card">
        <div className="row spread">
          <div>
            <h2>Admin</h2>
            <p className="muted">Inventario, usuarios y pedidos.</p>
          </div>
          <button className="btn" onClick={load}>
            Recargar
          </button>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="kpiLabel">Productos</div>
            <div className="kpiValue">{productos.length}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Usuarios</div>
            <div className="kpiValue">{usuarios.length}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Pedidos</div>
            <div className="kpiValue">{pedidos.length}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Sin asignar</div>
            <div className="kpiValue">{pedidosSinAsignar.length}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Gestionar productos</h3>
        <p className="muted small">
          Crear, actualizar y eliminar productos (requiere rol admin).
        </p>
        <div className="form">
          <div className="row">
            <label className="grow">
              ID (solo para editar)
              <input
                value={productForm.id_producto}
                onChange={(e) => setProductForm((f) => ({ ...f, id_producto: e.target.value }))}
                placeholder="ej: 1"
              />
            </label>
            <button
              className="btn"
              onClick={() => {
                const id = Number(productForm.id_producto)
                const found = productos.find((p) => Number(p.id_producto) === id)
                if (!found) return
                setProductForm({
                  id_producto: String(found.id_producto),
                  nombre: found.nombre || '',
                  descripcion: found.descripcion || '',
                  categoria: found.categoria || '',
                  imagen_url: found.imagen_url || '',
                  precio: String(found.precio ?? ''),
                  stock: String(found.stock ?? ''),
                })
                setCustomCategoria('')
              }}
              disabled={!productForm.id_producto}
            >
              Cargar desde lista
            </button>
            <button
              className="btn"
              onClick={() =>
                setProductForm({ id_producto: '', nombre: '', descripcion: '', categoria: '', imagen_url: '', precio: '', stock: '' })
              }
            >
              Limpiar
            </button>
          </div>

          <label>
            Nombre
            <input
              value={productForm.nombre}
              onChange={(e) => setProductForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Hamburguesa"
            />
          </label>
          <label>
            Descripción
            <input
              value={productForm.descripcion}
              onChange={(e) => setProductForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Con queso y papas"
            />
          </label>
          <label>
            Categoria
            <div className="row">
              <select
                value={productForm.categoria}
                onChange={(e) => setProductForm((f) => ({ ...f, categoria: e.target.value }))}
              >
                <option value="">(Sin categoria)</option>
                {productCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button type="button" className="btn small" onClick={() => setProductForm((f) => ({ ...f, categoria: '' }))}>
                Quitar
              </button>
            </div>
            <div className="muted small">Nueva categoria (opcional)</div>
            <input
              value={customCategoria}
              onChange={(e) => setCustomCategoria(e.target.value)}
              placeholder="Escribe una nueva categoria..."
            />
          </label>
          <label>
            Imagen (URL)
            <input
              value={productForm.imagen_url}
              onChange={(e) => setProductForm((f) => ({ ...f, imagen_url: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <div className="row">
            <label className="grow">
              Precio
              <input
                value={productForm.precio}
                onChange={(e) => setProductForm((f) => ({ ...f, precio: e.target.value }))}
                placeholder="12000"
              />
            </label>
            <label className="grow">
              Stock
              <input
                value={productForm.stock}
                onChange={(e) => setProductForm((f) => ({ ...f, stock: e.target.value }))}
                placeholder="10"
              />
            </label>
          </div>

          <div className="row">
            <button
              className="btn primary"
              onClick={async () => {
                setError('')
                try {
                  await api('/api/productos', {
                    method: 'POST',
                    body: {
                      nombre: productForm.nombre,
                      descripcion: productForm.descripcion,
                      categoria: String(customCategoria).trim() || productForm.categoria,
                      imagen_url: productForm.imagen_url,
                      precio: Number(productForm.precio),
                      stock: Number(productForm.stock),
                    },
                  })
                  setProductForm({ id_producto: '', nombre: '', descripcion: '', categoria: '', imagen_url: '', precio: '', stock: '' })
                  setCustomCategoria('')
                  await load()
                } catch (err) {
                  setError(err.message)
                }
              }}
              disabled={!productForm.nombre || !productForm.precio || !productForm.stock}
            >
              Agregar producto
            </button>

            <button
              className="btn"
              onClick={async () => {
                setError('')
                try {
                  await api(`/api/productos/${productForm.id_producto}`, {
                    method: 'PUT',
                    body: {
                      nombre: productForm.nombre,
                      descripcion: productForm.descripcion,
                      categoria: String(customCategoria).trim() || productForm.categoria,
                      imagen_url: productForm.imagen_url,
                      precio: Number(productForm.precio),
                      stock: Number(productForm.stock),
                    },
                  })
                  setCustomCategoria('')
                  await load()
                } catch (err) {
                  setError(err.message)
                }
              }}
              disabled={!productForm.id_producto}
            >
              Guardar cambios
            </button>

            <button
              className="btn danger"
              onClick={async () => {
                setError('')
                try {
                  await api(`/api/productos/${productForm.id_producto}`, { method: 'DELETE' })
                  setProductForm({ id_producto: '', nombre: '', descripcion: '', categoria: '', imagen_url: '', precio: '', stock: '' })
                  setCustomCategoria('')
                  await load()
                } catch (err) {
                  setError(err.message)
                }
              }}
              disabled={!productForm.id_producto}
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <DataCard
        title="Productos"
        columns={[
          ['imagen_url', 'Imagen'],
          ['id_producto', 'ID'],
          ['nombre', 'Nombre'],
          ['descripcion', 'Descripción'],
          ['categoria', 'Categoria'],
          ['precio', 'Precio'],
          ['stock', 'Stock'],
        ]}
        renderers={{
          imagen_url: (v) =>
            v ? <img className="thumb" src={v} alt="producto" loading="lazy" /> : <span className="muted small">-</span>,
        }}
        rows={productos}
      />

      <DataCard
        title="Pedidos"
        columns={[
          ['id_pedido', 'Pedido'],
          ['cliente_nombre', 'Cliente'],
          ['repartidor_nombre', 'Repartidor'],
          ['estado', 'Estado'],
          ['total', 'Total'],
          ['__detail', 'Detalle'],
        ]}
        renderers={{
          __detail: (_, r) => (
            <button className="btn small" onClick={() => openInvoice(r.id_pedido)}>
              Ver
            </button>
          ),
        }}
        rows={pedidos}
      />

      <div className="card">
        <h3>Asignar pedido a repartidor</h3>
        <div className="form">
          <label>
            Pedido sin asignar
            <select
              value={assign.id_pedido}
              onChange={(e) => setAssign((a) => ({ ...a, id_pedido: e.target.value }))}
            >
              <option value="">Selecciona...</option>
              {pedidosSinAsignar.map((p) => (
                <option key={p.id_pedido} value={p.id_pedido}>
                  #{p.id_pedido} {p.cliente_nombre ? `- ${p.cliente_nombre}` : ''} {p.estado ? `(${p.estado})` : ''}
                </option>
              ))}
            </select>
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
        title="Usuarios"
        columns={[
          ['id_usuario', 'ID'],
          ['nombre', 'Nombre'],
          ['email', 'Email'],
          ['rol', 'Rol'],
        ]}
        rows={usuarios}
      />

      {invoice.open ? (
        <InvoiceModal
          loading={invoice.loading}
          data={invoice.data}
          onClose={() => setInvoice({ open: false, loading: false, data: null })}
        />
      ) : null}
    </section>
  )
}

function ClienteView({ setError }) {
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [items, setItems] = useState([]) // [{id_producto,cantidad}]
  const [direccion, setDireccion] = useState('')
  const [query, setQuery] = useState('')
  const [invoice, setInvoice] = useState({ open: false, loading: false, data: null })
  const [category, setCategory] = useState('')

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

  const decItem = (id_producto) => {
    setItems((prev) =>
      prev
        .map((x) => (x.id_producto === id_producto ? { ...x, cantidad: x.cantidad - 1 } : x))
        .filter((x) => x.cantidad > 0),
    )
  }

  const removeItem = (id_producto) => {
    setItems((prev) => prev.filter((x) => x.id_producto !== id_producto))
  }

  const cartLines = items
    .map((it) => {
      const p = productos.find((x) => x.id_producto === it.id_producto)
      if (!p) return null
      const precio = Number(p.precio || 0)
      const subtotal = precio * Number(it.cantidad || 0)
      return {
        id_producto: it.id_producto,
        nombre: p.nombre,
        descripcion: p.descripcion || '',
        precio,
        cantidad: it.cantidad,
        subtotal,
      }
    })
    .filter(Boolean)

  const cartTotal = cartLines.reduce((acc, l) => acc + l.subtotal, 0)

  const activeProducts = productos.filter((p) => (p.activo === undefined ? true : Number(p.activo) !== 0))

  const categories = Array.from(
    new Set(activeProducts.map((p) => String(p.categoria || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  const filteredProducts = activeProducts
    .filter((p) => {
      const q = String(query || '').trim().toLowerCase()
      if (!q) return true
      const hay = `${p.nombre || ''} ${p.descripcion || ''} ${p.categoria || ''}`.toLowerCase()
      return hay.includes(q)
    })
    .filter((p) => {
      if (!category) return true
      return String(p.categoria || '').trim() === category
    })

  const grouped = filteredProducts.reduce((acc, p) => {
    const key = String(p.categoria || '').trim() || 'Sin categoria'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

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

  const openInvoice = async (id_pedido) => {
    setError('')
    setInvoice({ open: true, loading: true, data: null })
    try {
      const data = await api(`/api/pedidos/${id_pedido}`)
      setInvoice({ open: true, loading: false, data })
    } catch (err) {
      setInvoice({ open: false, loading: false, data: null })
      setError(err.message)
    }
  }

  return (
    <section className="grid">
      <div className="card">
        <div className="row spread">
          <div>
            <h2>Cliente</h2>
            <p className="muted">Explora productos y crea tus pedidos.</p>
          </div>
          <button className="btn" onClick={load}>
            Recargar
          </button>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="kpiLabel">Productos</div>
            <div className="kpiValue">{filteredProducts.length}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">En carrito</div>
            <div className="kpiValue">{cartLines.reduce((a, l) => a + Number(l.cantidad || 0), 0)}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Total</div>
            <div className="kpiValue">${cartTotal}</div>
          </div>
        </div>
      </div>

      <div className="card span8">
        <div className="row spread">
          <h3>Productos</h3>
          <div className="row">
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
            />
          </div>
        </div>
        <div className="chipRow" role="tablist" aria-label="Categorias">
          <button className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>
            Todas
          </button>
          {categories.map((c) => (
            <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="productGrid">
          {(category
            ? [{ key: category || 'Resultados', list: filteredProducts }]
            : Object.keys(grouped)
                .sort((a, b) => a.localeCompare(b))
                .map((k) => ({ key: k, list: grouped[k] }))
          ).map((g) => (
            <div key={g.key} className="catSection">
              <div className="sectionTitle">{g.key}</div>
              <div className="productGridInner">
                {g.list.map((p) => (
                  <div key={p.id_producto} className="productCard">
                    {p.imagen_url ? (
                      <img className="productImg" src={p.imagen_url} alt={p.nombre} loading="lazy" />
                    ) : (
                      <div className="productImg placeholder" />
                    )}
                    <div className="productName">{p.nombre}</div>
                    <div className="muted small clamp2">{p.descripcion || ''}</div>
                    <div className="row spread">
                      <div className="price">${p.precio}</div>
                      <button className="btn small primary" onClick={() => addItem(p.id_producto)}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card span4">
        <h3>Carrito</h3>
        <label className="block">
          Dirección de entrega
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle 123" />
        </label>

        <div className="cartList">
          {cartLines.length ? (
            cartLines.map((l) => (
              <div key={l.id_producto} className="cartRow">
                <div className="cartInfo">
                  <div className="strong">{l.nombre}</div>
                  <div className="muted small">${l.precio} c/u</div>
                </div>
                <div className="qty">
                  <button className="qtyBtn" onClick={() => decItem(l.id_producto)}>
                    -
                  </button>
                  <div className="qtyNum">{l.cantidad}</div>
                  <button className="qtyBtn" onClick={() => addItem(l.id_producto)}>
                    +
                  </button>
                </div>
                <div className="cartRight">
                  <div className="strong">${l.subtotal}</div>
                  <button className="linkDanger" onClick={() => removeItem(l.id_producto)}>
                    Quitar
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="muted small">Tu carrito está vacío</div>
          )}
        </div>

        <div className="cartTotal">
          <div className="muted small">Total</div>
          <div className="totalNum">${cartTotal}</div>
        </div>

        <div className="row">
          <button
            className="btn primary full"
            onClick={onCrearPedido}
            disabled={!cartLines.length || !String(direccion).trim()}
          >
            Pagar / Crear pedido
          </button>
          <button className="btn full" onClick={() => setItems([])} disabled={!cartLines.length}>
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
          ['__detail', 'Detalle'],
        ]}
        renderers={{
          __detail: (_, r) => (
            <button className="btn small" onClick={() => openInvoice(r.id_pedido)}>
              Ver
            </button>
          ),
        }}
        rows={pedidos}
      />

      {invoice.open ? (
        <InvoiceModal
          loading={invoice.loading}
          data={invoice.data}
          onClose={() => setInvoice({ open: false, loading: false, data: null })}
        />
      ) : null}
    </section>
  )
}

function RepartidorView({ setError }) {
  const [pedidos, setPedidos] = useState([])
  const [estados, setEstados] = useState([])
  const [update, setUpdate] = useState({ id_pedido: '', id_estado: '' })
  const [invoice, setInvoice] = useState({ open: false, loading: false, data: null })

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

  const openInvoice = async (id_pedido) => {
    setError('')
    setInvoice({ open: true, loading: true, data: null })
    try {
      const data = await api(`/api/pedidos/${id_pedido}`)
      setInvoice({ open: true, loading: false, data })
    } catch (err) {
      setInvoice({ open: false, loading: false, data: null })
      setError(err.message)
    }
  }

  return (
    <section className="grid">
      <div className="card">
        <div className="row spread">
          <div>
            <h2>Repartidor</h2>
            <p className="muted">Pedidos asignados y actualizacion de estado.</p>
          </div>
          <button className="btn" onClick={load}>
            Recargar
          </button>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="kpiLabel">Asignados</div>
            <div className="kpiValue">{pedidos.length}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Estados</div>
            <div className="kpiValue">{estados.length}</div>
          </div>
        </div>
      </div>

      <DataCard
        title="Pedidos asignados"
        columns={[
          ['id_pedido', 'Pedido'],
          ['cliente_nombre', 'Cliente'],
          ['direccion_entrega', 'Dirección'],
          ['estado', 'Estado'],
          ['total', 'Total'],
          ['__detail', 'Detalle'],
        ]}
        renderers={{
          __detail: (_, r) => (
            <button className="btn small" onClick={() => openInvoice(r.id_pedido)}>
              Ver
            </button>
          ),
        }}
        rows={pedidos}
      />

      <div className="card">
        <h3>Cambiar estado</h3>
        <div className="form">
          <label>
            Pedido
            <select value={update.id_pedido} onChange={(e) => setUpdate((u) => ({ ...u, id_pedido: e.target.value }))}>
              <option value="">Selecciona...</option>
              {pedidos.map((p) => (
                <option key={p.id_pedido} value={p.id_pedido}>
                  #{p.id_pedido} {p.cliente_nombre ? `- ${p.cliente_nombre}` : ''} {p.estado ? `(${p.estado})` : ''}
                </option>
              ))}
            </select>
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

      {invoice.open ? (
        <InvoiceModal
          loading={invoice.loading}
          data={invoice.data}
          onClose={() => setInvoice({ open: false, loading: false, data: null })}
        />
      ) : null}
    </section>
  )
}

function DataCard({ title, columns, rows, renderers }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="table">
        <Table columns={columns} rows={rows} renderers={renderers} />
      </div>
    </div>
  )
}

function Table({ columns, rows, renderers }) {
  if (!rows || rows.length === 0) {
    return <div className="muted small">Sin datos</div>
  }

  const cols = columns && columns.length ? columns : Object.keys(rows[0]).map((k) => [k, k])
  const rmap = renderers || {}

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
                <td key={key}>{rmap[key] ? rmap[key](r[key], r) : String(r[key] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InvoiceModal({ loading, data, onClose }) {
  const pedido = data?.pedido || null
  const detalle = data?.detalle || []

  const totalCalc = detalle.reduce((acc, d) => acc + Number(d.precio_unitario || 0) * Number(d.cantidad || 0), 0)
  const total = pedido && pedido.total !== undefined && pedido.total !== null ? pedido.total : totalCalc

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Detalle del pedido</div>
            {pedido ? (
              <div className="muted small">
                Pedido #{pedido.id_pedido} {pedido.estado ? `(${pedido.estado})` : ''}
              </div>
            ) : null}
          </div>
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {loading ? (
          <div className="muted">Cargando...</div>
        ) : pedido ? (
          <>
            <div className="invoiceMeta">
              <div className="metaItem">
                <div className="metaLabel">Cliente</div>
                <div className="metaValue">{pedido.cliente_nombre || '-'}</div>
              </div>
              <div className="metaItem">
                <div className="metaLabel">Direccion</div>
                <div className="metaValue">{pedido.direccion_entrega || '-'}</div>
              </div>
              <div className="metaItem">
                <div className="metaLabel">Repartidor</div>
                <div className="metaValue">{pedido.repartidor_nombre || '-'}</div>
              </div>
              <div className="metaItem">
                <div className="metaLabel">Total</div>
                <div className="metaValue">${total}</div>
              </div>
            </div>

            <div className="invoiceLines">
              <div className="tblWrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Unit.</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((d) => (
                      <tr key={d.id_detalle}>
                        <td>{d.producto || d.id_producto}</td>
                        <td>{d.cantidad}</td>
                        <td>${d.precio_unitario}</td>
                        <td>${Number(d.precio_unitario || 0) * Number(d.cantidad || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="invoiceFooter">
              <div className="muted small">Total calculado</div>
              <div className="totalNum">${totalCalc}</div>
            </div>
          </>
        ) : (
          <div className="muted">No hay datos del pedido.</div>
        )}
      </div>
    </div>
  )
}
