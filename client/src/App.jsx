import { useEffect, useMemo, useState } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct, register, login, getMe, logout, getAdminOverview, setShopStatus } from './api';
import './App.css';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);
const emptyForm = { name: '', sku: '', category: 'Groceries', price: '', stock: '', icon: '📦' };
const defaultCategories = ['Groceries', 'Beverages', 'Snacks', 'Household', 'Personal Care', 'Other'];

function InventoryApp({ user, onLogout }) {
  const [products, setProducts] = useState([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => ['All', ...new Set([...defaultCategories, ...products.map(p => p.category).filter(Boolean)])], [products]);

  useEffect(() => {
    let active = true;
    getProducts().then(data => { if (active) { setProducts(data); setApiConnected(true); } })
      .catch(error => { console.error('Could not load products:', error); if (active) { setApiConnected(false); setNotice('Could not connect. Check your internet connection and try refreshing.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => products.filter(product => {
    const matchesSearch = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || product.category === category;
    const matchesPage = page !== 'Low Stock' || product.stock <= 10;
    return matchesSearch && matchesCategory && matchesPage;
  }), [products, search, category, page]);

  const totalUnits = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const inventoryValue = products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0);
  const lowStockProducts = products.filter(product => Number(product.stock) > 0 && Number(product.stock) <= 10);
  const outOfStockProducts = products.filter(product => Number(product.stock) === 0);
  const attentionCount = lowStockProducts.length + outOfStockProducts.length;
  const recentProducts = [...products].slice(0, 5);

  function openAdd() { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }
  function openEdit(product) {
    setEditing(product.id);
    setForm({ name: product.name, sku: product.sku, category: product.category, price: String(product.price), stock: String(product.stock), icon: product.icon || '📦' });
    setShowForm(true);
  }
  async function saveProduct(event) {
    event.preventDefault();
    const name = form.name.trim(); const sku = form.sku.trim(); const price = Number(form.price); const stock = Number(form.stock);
    if (!name || !sku || form.price === '' || form.stock === '' || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setNotice('Enter a product name, code, valid price and whole-number quantity.'); return;
    }
    if (products.some(p => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== editing)) { setNotice('That product code already exists. Please use a different one.'); return; }
    const payload = { name, sku, category: form.category, price, stock, icon: form.icon.trim() || '📦' };
    setBusy(true);
    try {
      if (editing !== null) {
        const updated = await updateProduct(editing, payload);
        setProducts(current => current.map(p => p.id === editing ? updated : p)); setNotice('Product updated.');
      } else {
        const created = await createProduct(payload); setProducts(current => [created, ...current]); setNotice('Product added.');
      }
      setApiConnected(true); setShowForm(false);
    } catch (error) { setNotice(error.message || 'Could not save the product.'); }
    finally { setBusy(false); }
  }
  async function removeProduct(product) {
    if (!window.confirm(`Delete ${product.name} from your stock?`)) return;
    try { await deleteProduct(product.id); setProducts(current => current.filter(p => p.id !== product.id)); setNotice('Product deleted.'); }
    catch (error) { setNotice(error.message || 'Could not delete the product.'); }
  }
  async function changeStock(product, amount) {
    const nextStock = Math.max(0, Number(product.stock) + amount);
    if (nextStock === Number(product.stock)) { setNotice('Stock cannot go below zero.'); return; }
    try {
      const updated = await updateProduct(product.id, { name: product.name, sku: product.sku, category: product.category, price: product.price, stock: nextStock, icon: product.icon || '📦' });
      setProducts(current => current.map(p => p.id === product.id ? updated : p)); setNotice(`${product.name}: quantity is now ${updated.stock}.`);
    } catch (error) { setNotice(error.message || 'Could not update stock.'); }
  }
  function exportCSV() {
    const rows = [['Product', 'Code', 'Category', 'Price (INR)', 'Quantity', 'Stock Value'], ...products.map(p => [p.name, p.sku, p.category, p.price, p.stock, p.price * p.stock])];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'stockease-inventory.csv'; link.click(); URL.revokeObjectURL(url); setNotice('Stock list downloaded.');
  }
  const navItems = [
    { name: 'Dashboard', icon: '⌂' }, { name: 'Products', icon: '▦' }, { name: 'Add Product', icon: '＋', action: openAdd },
    { name: 'Stock List', icon: '☷' }, { name: 'Low Stock', icon: '⚠', count: attentionCount }, { name: 'Categories', icon: '◆' },
  ];
  function navigate(name) {
    if (name === 'Add Product') { openAdd(); return; }
    setPage(name === 'Stock List' ? 'Products' : name); setSearch(''); setCategory('All');
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">🛍</div><div><strong>Stock<span>Ease</span></strong><small>Your Shop, Made Simple</small></div></div>
      <div className="nav-caption">YOUR SHOP</div>
      <nav className="side-nav">{navItems.map(item => <button key={item.name} className={`nav-item ${((page === 'Dashboard' && item.name === 'Dashboard') || (page === 'Products' && ['Products','Stock List'].includes(item.name)) || page === item.name) ? 'active' : ''}`} onClick={() => navigate(item.name)}><span className={`nav-icon nav-${item.name.toLowerCase().replaceAll(' ', '-')}`}>{item.icon}</span><span>{item.name}</span>{item.count > 0 && <b className="nav-count">{item.count}</b>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="help-card"><div className="help-icon">💡</div><strong>Need a hand?</strong><p>Your stock, all in one easy place.</p><button onClick={() => setNotice('Tip: use Add Product to enter a new item, or the + and − buttons to adjust quantity.')}>Quick tip <span>→</span></button></div>
      <button className="logout-button" onClick={onLogout}><span>↪</span> Logout</button>
      <div className="sidebar-user"><div className="user-avatar">{(user?.name || user?.email || 'S')[0].toUpperCase()}</div><div><strong>{user?.name || 'Shop Owner'}</strong><small>Shop account</small></div><span className="user-menu">•••</span></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="mobile-brand"><span>🛍</span> Stock<span>Ease</span></div><div className="topbar-search"><span>⌕</span><input value={search} onChange={e => { setSearch(e.target.value); if (page === 'Dashboard') setPage('Products'); }} placeholder="Search products, code, or category..." aria-label="Search products" /></div><div className="topbar-user"><div className="top-avatar">{(user?.name || user?.email || 'S')[0].toUpperCase()}</div><div><strong>{user?.name || 'Shop Owner'}</strong><small>{loading ? 'Loading your stock…' : apiConnected ? 'Your shop is connected' : 'Connection issue'}</small></div><span className={`connection-dot ${apiConnected ? 'online' : ''}`} title={apiConnected ? 'Connected' : 'Not connected'} /></div></header>
      <div className="page-content">
        <section className="welcome-row"><div><div className="eyebrow">YOUR SHOP AT A GLANCE</div><h1>{page === 'Dashboard' ? <>Welcome to Stock<span>Ease</span>! <span className="wave">👋</span></> : page === 'Low Stock' ? 'Items to Restock' : page === 'Categories' ? 'Your Categories' : 'Your Products'}</h1><p>{page === 'Dashboard' ? 'Manage your shop stock easily and stay organized.' : page === 'Low Stock' ? 'These items may need a refill soon.' : page === 'Categories' ? 'Find products by the type of item.' : 'Find, update, and manage your shop items.'}</p></div><div className="welcome-actions"><button className="button button-light" onClick={exportCSV}>↓ Download Stock List</button><button className="button button-primary" onClick={openAdd}><span>＋</span> Add Product</button></div></section>
        {!apiConnected && !loading && <div className="connection-warning"><span>⚠</span><div><strong>We couldn't load your stock</strong><p>Check your connection and refresh the page.</p></div></div>}

        <section className="stat-grid">
          <article className="stat-card stat-blue"><div className="stat-icon">▦</div><div className="stat-label">Total Products</div><div className="stat-number">{products.length.toLocaleString('en-IN')}</div><div className="stat-note">Different items in your shop</div></article>
          <article className="stat-card stat-green"><div className="stat-icon">▤</div><div className="stat-label">Total Stock Quantity</div><div className="stat-number">{totalUnits.toLocaleString('en-IN')}</div><div className="stat-note">Pieces available in total</div></article>
          <article className="stat-card stat-yellow"><div className="stat-icon">₹</div><div className="stat-label">Total Stock Value</div><div className="stat-number stat-money">{money(inventoryValue)}</div><div className="stat-note">Value at listed prices</div></article>
          <article className="stat-card stat-pink"><div className="stat-icon">⚠</div><div className="stat-label">Low Stock Items</div><div className="stat-number">{attentionCount}</div><div className="stat-note">Items to check or refill</div></article>
        </section>

        {page === 'Categories' ? <section className="category-page panel"><div className="section-heading"><div><h2>Choose a category</h2><p>Tap a category to see those products.</p></div></div><div className="category-grid">{categories.filter(c => c !== 'All').map((cat, i) => <button className={`category-tile cat-color-${i % 6}`} key={cat} onClick={() => { setCategory(cat); setPage('Products'); }}><span>{['🍪','🥤','🍿','🧹','🧴','📦'][i % 6]}</span><strong>{cat}</strong><small>{products.filter(p => p.category === cat).length} products</small></button>)}</div></section> : page === 'Analytics' ? <section className="panel"><div className="section-heading"><div><h2>Stock by category</h2><p>A simple look at the items you keep.</p></div></div><div className="category-grid">{categories.filter(c => c !== 'All').map((cat, i) => <button className={`category-tile cat-color-${i % 6}`} key={cat} onClick={() => { setCategory(cat); setPage('Products'); }}><span>{['🍪','🥤','🍿','🧹','🧴','📦'][i % 6]}</span><strong>{cat}</strong><small>{products.filter(p => p.category === cat).reduce((n,p) => n + Number(p.stock || 0),0)} pieces</small></button>)}</div></section> : <>
          {page === 'Dashboard' && <section className="quick-actions"><button className="quick-card quick-add" onClick={openAdd}><span className="quick-icon">＋</span><span><strong>Add New Product</strong><small>Add an item to your shop</small></span><b>›</b></button><button className="quick-card quick-view" onClick={() => navigate('Products')}><span className="quick-icon">☷</span><span><strong>View All Products</strong><small>See and manage your stock</small></span><b>›</b></button><button className="quick-card quick-search" onClick={() => { setPage('Products'); document.querySelector('.table-search-input')?.focus(); }}><span className="quick-icon">⌕</span><span><strong>Search Product</strong><small>Find an item quickly</small></span><b>›</b></button></section>}
          <div className={page === 'Dashboard' ? 'dashboard-lower' : 'dashboard-lower single-panel'}>
            <section className="panel products-panel"><div className="section-heading"><div><h2>{page === 'Dashboard' ? 'Recent Products' : page === 'Low Stock' ? 'Items to Restock' : 'Your Stock List'}</h2><p>{page === 'Dashboard' ? 'Your latest items, all in one place.' : 'Use search or category to find an item.'}</p></div>{page === 'Dashboard' && <button className="outline-button" onClick={() => navigate('Products')}>View All Products <span>→</span></button>}</div>
              <div className="table-tools"><div className="table-search"><span>⌕</span><input className="table-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." aria-label="Search inventory" /></div><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">{categories.map(c => <option key={c}>{c}</option>)}</select><button className="reset-button" onClick={() => { setSearch(''); setCategory('All'); }}>Reset</button></div>
              <div className="table-wrap"><table><thead><tr><th>Product Name</th><th>Code</th><th>Category</th><th>Price</th><th>Quantity</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {(page === 'Dashboard' ? filtered.slice(0,5) : filtered).map(product => { const stock = Number(product.stock || 0); const status = stock === 0 ? 'Out of Stock' : stock <= 10 ? 'Low Stock' : 'In Stock'; return <tr key={product.id}><td><div className="product-cell"><span className="product-emoji">{product.icon || '📦'}</span><strong>{product.name}</strong></div></td><td className="sku-cell">{product.sku}</td><td><span className={`category-pill cat-pill-${Math.abs(String(product.category || '').length) % 6}`}>{product.category}</span></td><td className="price-cell">{money(product.price)}</td><td><div className="quantity-control"><button aria-label={`Decrease ${product.name} quantity`} onClick={() => changeStock(product,-1)}>−</button><strong>{stock}</strong><button aria-label={`Increase ${product.name} quantity`} onClick={() => changeStock(product,1)}>＋</button></div></td><td><span className={`status-pill ${stock === 0 ? 'status-out' : stock <= 10 ? 'status-low' : 'status-good'}`}>{status}</span></td><td><div className="row-actions"><button className="edit-action" title="Edit product" onClick={() => openEdit(product)}>✎</button><button className="delete-action" title="Delete product" onClick={() => removeProduct(product)}>×</button></div></td></tr>; })}
                {loading && <tr><td colSpan="7"><div className="empty-state">Loading your stock…</div></td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan="7"><div className="empty-state"><span>📦</span><strong>No products found</strong><p>Add your first product to get started.</p><button className="button button-primary" onClick={openAdd}>＋ Add Product</button></div></td></tr>}
              </tbody></table></div><div className="table-footer"><span>Showing <strong>{page === 'Dashboard' ? Math.min(filtered.length,5) : filtered.length}</strong> of <strong>{filtered.length}</strong> products</span><span className="footer-connection"><i className={apiConnected ? 'online' : ''}/> {apiConnected ? 'Stock is up to date' : 'Not connected'}</span></div>
            </section>
            {page === 'Dashboard' && <aside className="dashboard-side"><section className="panel category-panel"><div className="mini-panel-heading"><div><span className="mini-heading-icon">◆</span><h3>Quick Categories</h3></div><button onClick={() => navigate('Categories')}>View all →</button></div><div className="mini-category-grid">{categories.filter(c => c !== 'All').slice(0,6).map((cat,i) => <button className={`mini-category cat-color-${i % 6}`} key={cat} onClick={() => { setCategory(cat); setPage('Products'); }}><span>{['🍪','🥤','🍿','🧹','🧴','📦'][i % 6]}</span><strong>{cat}</strong></button>)}</div></section>
              <section className="panel low-stock-panel"><div className="mini-panel-heading"><div><span className="mini-heading-icon alert-icon">⚠</span><h3>Low Stock Alert</h3></div><button onClick={() => navigate('Low Stock')}>View all →</button></div>{[...lowStockProducts, ...outOfStockProducts].slice(0,4).length ? [...lowStockProducts, ...outOfStockProducts].slice(0,4).map(p => <div className="alert-row" key={p.id}><span className="alert-product-icon">{p.icon || '📦'}</span><strong>{p.name}</strong><span>{p.stock === 0 ? 'Out' : `${p.stock} left`}</span></div>) : <div className="all-good"><span>✓</span><p>Everything looks good. No low-stock items.</p></div>}</section></aside>}
          </div>
        </>}
        <footer className="app-footer"><span>🛍 <strong>StockPilot</strong> <small>YOUR SHOP, MADE SIMPLE</small></span><span>{apiConnected ? 'Your inventory is connected' : 'Inventory workspace'}</span></footer>
      </div>
    </main>
    {notice && <div className="toast"><span>✓</span>{notice}</div>}
    {showForm && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setShowForm(false); }}><form className="product-modal" onSubmit={saveProduct}><div className="modal-heading"><div><span className="modal-kicker">YOUR SHOP INVENTORY</span><h2>{editing !== null ? 'Edit Product' : 'Add a Product'}</h2><p>Enter a few details to keep your stock up to date.</p></div><button type="button" className="modal-close" onClick={() => setShowForm(false)} disabled={busy}>×</button></div>
      <label>Product Name<input required maxLength="80" placeholder="e.g. Parle-G Biscuits" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><div className="form-row"><label>Product Code / SKU<input required maxLength="30" placeholder="e.g. BIS-001" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}/></label><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}</select></label></div><div className="form-row"><label>Price (₹)<input required type="number" min="0" step="0.01" placeholder="20" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}/></label><label>Quantity in Stock<input required type="number" min="0" step="1" placeholder="10" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}/></label></div><label>Product Icon (optional)<input maxLength="8" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}/></label><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setShowForm(false)} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editing !== null ? 'Save Changes' : '＋ Add Product'}</button></div></form></div>}
  </div>;
}

function AdminApp({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  async function refresh() {
    setLoading(true); setError('');
    try { setData(await getAdminOverview()); }
    catch (err) { setError(err.message || 'Could not load admin data.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  async function toggleShop(shop) {
    const status = shop.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`${status === 'suspended' ? 'Suspend' : 'Activate'} ${shop.name || shop.email}?`)) return;
    setBusyId(shop.id);
    try { await setShopStatus(shop.id, status); await refresh(); }
    catch (err) { setError(err.message || 'Could not update shop status.'); }
    finally { setBusyId(null); }
  }
  const stats = data?.stats || {};
  const cardStyle = { background:'#fff', border:'1px solid #e5edf5', borderRadius:14, padding:'20px', boxShadow:'0 4px 16px rgba(30,55,90,.04)' };
  return <div style={{minHeight:'100vh',background:'#f6f8fb',color:'#10203e',fontFamily:'system-ui, sans-serif'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,padding:'18px clamp(16px,4vw,48px)',background:'#fff',borderBottom:'1px solid #e5edf5'}}>
      <div><div style={{fontWeight:900,fontSize:24}}>Stock<span style={{color:'#09a86d'}}>Ease</span> <span style={{fontSize:12,color:'#657791'}}>ADMIN</span></div><div style={{fontSize:12,color:'#657791',marginTop:4}}>Platform control centre</div></div>
      <div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:13,color:'#536783'}}>{user?.name || user?.email}</span><button className="button button-light" onClick={onLogout}>Logout</button></div>
    </header>
    <main style={{maxWidth:1400,margin:'0 auto',padding:'28px clamp(16px,4vw,48px)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:22}}><div><h1 style={{margin:'0 0 6px',fontSize:30}}>Admin dashboard</h1><p style={{margin:0,color:'#657791'}}>Manage shopkeeper accounts and monitor StockPilot.</p></div><button className="button button-primary" onClick={refresh} disabled={loading}>{loading?'Refreshing…':'↻ Refresh'}</button></div>
      {error && <div className="auth-error" style={{marginBottom:16}}>{error}</div>}
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:24}}>
        {[['Registered shops',stats.totalShops??'—','🏪'],['Active shops',stats.activeShops??'—','✓'],['Suspended shops',stats.suspendedShops??'—','⏸'],['Products tracked',stats.totalProducts??'—','📦'],['Units in stock',stats.totalUnits??'—','▦'],['Inventory value',stats.inventoryValue==null?'—':money(stats.inventoryValue),'₹']].map(([label,value,icon])=><article key={label} style={cardStyle}><div style={{fontSize:22}}>{icon}</div><div style={{fontSize:12,color:'#657791',marginTop:12}}>{label}</div><div style={{fontSize:26,fontWeight:850,marginTop:4,overflowWrap:'anywhere'}}>{value}</div></article>)}
      </section>
      <section style={{...cardStyle,padding:0,overflow:'hidden'}}><div style={{padding:'18px 20px',borderBottom:'1px solid #e5edf5'}}><h2 style={{margin:0,fontSize:19}}>Shopkeeper accounts</h2><p style={{margin:'5px 0 0',fontSize:12,color:'#657791'}}>Account status changes are enforced by the backend.</p></div>
        {loading && <p style={{padding:20,color:'#657791'}}>Loading shop accounts…</p>}
        {!loading && !data?.shops?.length && <p style={{padding:20,color:'#657791'}}>No shopkeeper accounts found yet. New registrations will appear here.</p>}
        {!!data?.shops?.length && <div style={{overflowX:'auto'}}><table style={{minWidth:760}}><thead><tr><th>Shopkeeper</th><th>Email</th><th>Products</th><th>Units</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.shops.map(shop=><tr key={shop.id}><td>{shop.name || '—'}</td><td>{shop.email}</td><td>{shop.product_count}</td><td>{shop.total_units}</td><td><span className={`status-pill ${shop.status==='active'?'status-good':'status-out'}`}>{shop.status}</span></td><td><button className="outline-button" disabled={busyId===shop.id} onClick={()=>toggleShop(shop)}>{busyId===shop.id?'Saving…':shop.status==='active'?'Suspend':'Activate'}</button></td></tr>)}</tbody></table></div>}
      </section>
      <p style={{fontSize:11,color:'#7b8ba0',marginTop:18}}>Admin access is controlled by the server. Public registration cannot grant admin privileges.</p>
    </main>
  </div>;
}

function App() {
  const [user, setUser] = useState(null); const [checking, setChecking] = useState(true); const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  useEffect(() => { if (!localStorage.getItem('stockpilot_token')) { setChecking(false); return; } getMe().then(data => setUser(data.user)).catch(() => localStorage.removeItem('stockpilot_token')).finally(() => setChecking(false)); }, []);
  async function submit(e) { e.preventDefault(); setError(''); if (mode === 'register' && password !== confirmPassword) { setError('Passwords do not match.'); return; } setWorking(true); try { const data = mode === 'login' ? await login(email,password) : await register(fullName,email,password); localStorage.setItem('stockpilot_token',data.token); setUser(data.user); } catch (err) { setError(err.message || 'Could not sign in. Please try again.'); } finally { setWorking(false); } }
  async function signOut() { try { await logout(); } catch {} localStorage.removeItem('stockpilot_token'); setUser(null); setPassword(''); }
  if (checking) return <div className="auth-screen"><div className="auth-card auth-loading"><div className="auth-logo">🛍</div><h1>Stock<span>Ease</span></h1><p>Getting your shop ready…</p></div></div>;
  if (!user) return <div className="auth-screen"><div className="auth-decoration auth-decoration-one"/><div className="auth-decoration auth-decoration-two"/><form className="auth-card" onSubmit={submit}><div className="auth-logo">🛍</div><div className="auth-kicker">YOUR SHOP, MADE SIMPLE</div><h1>{mode === 'login' ? 'Welcome back!' : 'Let’s set up your shop.'}</h1><p className="auth-subtitle">{mode === 'login' ? 'Sign in to see and manage your stock.' : 'Create your account to get started.'}</p>
    {mode === 'register' && <><label htmlFor="auth-name">Your Name</label><input id="auth-name" type="text" autoComplete="name" placeholder="Enter your name" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} required/></>}
    <label htmlFor="auth-email">Email Address</label><input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
    <label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode === 'login' ? 1 : 8} required/>
    {mode === 'register' && <><label htmlFor="auth-confirm-password">Confirm Password</label><input id="auth-confirm-password" type="password" autoComplete="new-password" placeholder="Enter password again" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={8} required/></>}
    {error && <div className="auth-error">{error}</div>}<button className="auth-submit" type="submit" disabled={working}>{working ? 'Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}</button><div className="auth-switch">{mode === 'login' ? 'New to StockPilot?' : 'Already have an account?'} <button type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setPassword('');setConfirmPassword('');}}>{mode==='login'?'Create account':'Sign in'}</button></div><div className="auth-security"><span/> Your shop inventory is private to your account</div>
  </form></div>;
  return user.role === 'admin' ? <AdminApp user={user} onLogout={signOut}/> : <InventoryApp user={user} onLogout={signOut}/>;
}
export default App;
