
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\\/$/, '');

const token = () => localStorage.getItem('stockpilot_token');

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot connect to server. Check the backend and CORS settings.');
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  let data = {};

  if (contentType.includes('application/json')) {
    try { data = await response.json(); } catch { data = {}; }
  } else {
    const text = await response.text();
    data = text ? { error: text } : {};
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status}).`);
  }

  return data;
}

export async function register(name, email, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return request('/auth/me');
}

export async function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export async function getProducts() {
  return request('/products');
}

export async function createProduct(product) {
  return request('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

export async function updateProduct(id, product) {
  return request(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  });
}

export async function deleteProduct(id) {
  return request(`/products/${id}`, { method: 'DELETE' });
}

export async function getAdminOverview() {
  return request('/admin/overview');
}

export async function updateShopStatus(id, status) {
  return request(`/admin/shops/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function setShopStatus(id, status) {
  return updateShopStatus(id, status);
}
