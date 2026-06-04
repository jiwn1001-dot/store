import { storeData } from './data.js';
import { supabase } from './supabase.js';
import './style.css';

// === STATE ===
const state = {
  currentCategory: null,
  currentSubcategory: null,
  searchQuery: '',
  gradeFilters: new Set(),
  sortBy: 'price-asc',
  viewMode: 'grid',
  page: 1,
  perPage: 36,
  allItems: [],
  filteredItems: [],
  users: JSON.parse(localStorage.getItem('bm_users')) || {},
  currentUser: localStorage.getItem('bm_currentUser') || null,
  cart: [],
  orders: [],
  // Admin & Auth
  isAdmin: false,
  supabaseUser: null,
  customCategories: JSON.parse(localStorage.getItem('bm_custom_categories')) || [],
  customItems: JSON.parse(localStorage.getItem('bm_custom_items')) || [],
  deletedItems: JSON.parse(localStorage.getItem('bm_deleted_items')) || [],
  adminTab: 'dashboard',
  memberDetailId: null,
};

function saveState() {
  if (state.currentUser) {
    if (!state.users[state.currentUser]) state.users[state.currentUser] = { cart: [], orders: [] };
    state.users[state.currentUser].cart = state.cart;
    state.users[state.currentUser].orders = state.orders;
    localStorage.setItem('bm_users', JSON.stringify(state.users));
  }
}

function saveCustomData() {
  localStorage.setItem('bm_custom_categories', JSON.stringify(state.customCategories));
  localStorage.setItem('bm_custom_items', JSON.stringify(state.customItems));
}

// === CATEGORY STRUCTURE ===
const categoryIcons = {
  '무기': '🔫', '방어구': '🛡️', '소모품': '🧪', '사이버웨어': '⚡', '소재': '💎', '몬스터': '👹', '기타': '📦'
};

function buildCategoryTree() {
  const tree = {};
  const all = getAllItems();
  all.forEach(item => {
    const cat = item.category || '기타';
    const sub = item.subcategory || '미분류';
    if (!tree[cat]) tree[cat] = {};
    if (!tree[cat][sub]) tree[cat][sub] = 0;
    tree[cat][sub]++;
  });
  // Include custom categories even if empty
  state.customCategories.forEach(cc => {
    if (!tree[cc.name]) tree[cc.name] = {};
    categoryIcons[cc.name] = cc.icon || '📁';
  });
  return tree;
}

function getAllItems() {
  const items = [...storeData.items];
  storeData.food.forEach(f => items.push({ ...f, category: '소모품' }));
  storeData.materials.forEach(m => items.push({ ...m, category: '소재' }));
  // Monsters handled separately
  storeData.monsters.forEach(m => {
    items.push({
      name: m.name,
      type: '몬스터',
      category: '몬스터',
      subcategory: m.subcategory,
      description: `ATK: ${m.attack_dice} | DEF: ${m.defense} | HP: ${m.hp} | EXP: ${m.exp_reward}`,
      attack_dice: m.attack_dice,
      defense: m.defense,
      hp: m.hp,
      exp_reward: m.exp_reward,
      drops: m.drops,
      price: 0,
      grade: m.subcategory === '안전등급' ? '안전' : m.subcategory === '주의등급' ? '주의' : '위험',
      gradeRank: m.subcategory === '안전등급' ? 1 : m.subcategory === '주의등급' ? 2 : 3,
    });
  });
  // Merge custom items
  state.customItems.forEach(ci => {
    items.push({ ...ci, _custom: true });
  });
  
  // Filter out deleted items
  return items.filter(item => !state.deletedItems.includes(item.name));
}

// === FORMAT ===
function formatPrice(p) {
  if (!p || p === 0) return '-';
  if (p >= 100000000) return (p / 100000000).toFixed(p % 100000000 === 0 ? 0 : 1) + '억';
  if (p >= 10000) return (p / 10000).toFixed(p % 10000 === 0 ? 0 : 0) + '만';
  return p.toLocaleString();
}

function formatFullPrice(p) {
  if (!p) return '-';
  return p.toLocaleString() + ' ₩';
}

function getGradeColor(grade) {
  const colors = { '중고': '#777', '시장제': '#4a9', '명품': '#c8a030', '군용': '#3a8', '기업제': '#a040e0', '프로토타입': '#ff2060', '일반': '#666', '안전': '#4a9', '주의': '#c8a030', '위험': '#ff2060' };
  return colors[grade] || '#666';
}

// === RENDER NAV ===
function renderNav() {
  const tree = buildCategoryTree();
  const nav = document.getElementById('category-nav');
  // Define order
  const catOrder = ['무기', '방어구', '사이버웨어', '소모품', '소재', '몬스터', '기타'];
  // Add custom categories that aren't in the default order
  state.customCategories.forEach(cc => {
    if (!catOrder.includes(cc.name)) catOrder.push(cc.name);
  });
  let html = '';
  catOrder.forEach(cat => {
    if (!tree[cat]) return;
    const subs = tree[cat];
    const totalCount = Object.values(subs).reduce((a, b) => a + b, 0);
    const isActive = state.currentCategory === cat;
    html += `<div class="nav-category">
      <div class="nav-cat-header ${isActive ? 'active open' : ''}" data-cat="${cat}">
        <span class="cat-icon">${categoryIcons[cat] || '📦'}</span>
        <span>${cat}</span>
        <span class="cat-count">${totalCount}</span>
        <span class="arrow">▸</span>
      </div>
      <div class="nav-subcats ${isActive ? 'open' : ''}">`;
    // Sort subcategories
    Object.entries(subs).sort((a, b) => a[0].localeCompare(b[0])).forEach(([sub, count]) => {
      const isSubActive = state.currentCategory === cat && state.currentSubcategory === sub;
      html += `<div class="nav-subcat ${isSubActive ? 'active' : ''}" data-cat="${cat}" data-sub="${sub}">
        <span>${sub}</span>
        <span class="sub-count">${count}</span>
      </div>`;
    });
    html += `</div></div>`;
  });
  nav.innerHTML = html;

  // Events
  nav.querySelectorAll('.nav-cat-header').forEach(el => {
    el.addEventListener('click', () => {
      const cat = el.dataset.cat;
      // Toggle open
      const wasOpen = el.classList.contains('open');
      nav.querySelectorAll('.nav-cat-header').forEach(h => { h.classList.remove('open', 'active'); h.nextElementSibling?.classList.remove('open'); });
      if (!wasOpen) {
        el.classList.add('open', 'active');
        el.nextElementSibling?.classList.add('open');
      }
      state.currentCategory = wasOpen ? null : cat;
      state.currentSubcategory = null;
      state.page = 1;
      applyFilters();
      renderBreadcrumb();
      closeMobileSidebar();
    });
  });

  nav.querySelectorAll('.nav-subcat').forEach(el => {
    el.addEventListener('click', () => {
      nav.querySelectorAll('.nav-subcat').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      state.currentCategory = el.dataset.cat;
      state.currentSubcategory = el.dataset.sub;
      state.page = 1;
      // Ensure parent is open
      const parentHeader = el.closest('.nav-category').querySelector('.nav-cat-header');
      parentHeader.classList.add('active', 'open');
      parentHeader.nextElementSibling?.classList.add('open');
      applyFilters();
      renderBreadcrumb();
      closeMobileSidebar();
    });
  });
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.add('mobile-open');
  backdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.remove('mobile-open');
  backdrop.classList.remove('visible');
  document.body.style.overflow = '';
}

// === BREADCRUMB ===
function renderBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  let html = `<span class="bc-item" data-action="home">黒市場</span>`;
  if (state.currentCategory) {
    html += `<span class="bc-sep">▸</span><span class="bc-item ${!state.currentSubcategory ? 'current' : ''}" data-action="cat" data-cat="${state.currentCategory}">${state.currentCategory}</span>`;
  }
  if (state.currentSubcategory) {
    html += `<span class="bc-sep">▸</span><span class="bc-item current">${state.currentSubcategory}</span>`;
  }
  bc.innerHTML = html;
  bc.querySelectorAll('.bc-item').forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('current')) return;
      const action = el.dataset.action;
      if (action === 'home') {
        state.currentCategory = null;
        state.currentSubcategory = null;
      } else if (action === 'cat') {
        state.currentSubcategory = null;
      }
      state.page = 1;
      applyFilters();
      renderBreadcrumb();
      renderNav();
    });
  });
}

// === GRADE FILTERS ===
function renderGradeFilters() {
  const grades = ['중고', '시장제', '명품', '군용', '기업제', '프로토타입'];
  const container = document.getElementById('grade-filters');
  container.innerHTML = grades.map(g =>
    `<button class="grade-btn ${state.gradeFilters.has(g) ? 'active' : ''}" data-grade="${g}">${g}</button>`
  ).join('');
  container.querySelectorAll('.grade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.grade;
      if (state.gradeFilters.has(g)) state.gradeFilters.delete(g);
      else state.gradeFilters.add(g);
      btn.classList.toggle('active');
      state.page = 1;
      applyFilters();
    });
  });
}

// === FILTERING ===
function applyFilters() {
  let items = getAllItems();

  // Category filter
  if (state.currentCategory) {
    items = items.filter(i => i.category === state.currentCategory);
  }
  if (state.currentSubcategory) {
    items = items.filter(i => i.subcategory === state.currentSubcategory);
  }

  // Grade filter
  if (state.gradeFilters.size > 0) {
    items = items.filter(i => state.gradeFilters.has(i.grade));
  }

  // Search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter(i =>
      i.name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.subcategory?.toLowerCase().includes(q) ||
      i.grade?.toLowerCase().includes(q)
    );
  }

  // Sort
  items.sort((a, b) => {
    switch (state.sortBy) {
      case 'price-asc': return (a.price || 0) - (b.price || 0);
      case 'price-desc': return (b.price || 0) - (a.price || 0);
      case 'grade-asc': return (a.gradeRank || 0) - (b.gradeRank || 0);
      case 'grade-desc': return (b.gradeRank || 0) - (a.gradeRank || 0);
      case 'name': return (a.name || '').localeCompare(b.name || '');
      default: return 0;
    }
  });

  state.filteredItems = items;
  document.getElementById('result-count').textContent = `${items.length}개 품목`;
  renderItems();
  renderPagination();
}

// === RENDER ITEMS ===
function renderItems() {
  const container = document.getElementById('items-container');
  const { filteredItems, page, perPage, viewMode } = state;
  const start = (page - 1) * perPage;
  const pageItems = filteredItems.slice(start, start + perPage);

  container.className = viewMode === 'grid' ? 'items-grid' : 'items-list';

  if (pageItems.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">∅</div><div class="empty-text">검색 결과가 없습니다.<br>다른 필터를 시도해보세요.</div></div>`;
    return;
  }

  container.innerHTML = pageItems.map((item, idx) => {
    if (item.category === '몬스터') return renderMonsterCard(item);
    const grade = item.grade || '일반';
    const stats = [];
    if (item.dice) stats.push(`⚔️ ${item.dice}`);
    if (item.defense) stats.push(`🛡️ ${item.defense}`);
    if (item.bonus_hp) stats.push(`❤️ +${item.bonus_hp}`);
    if (item.heal) stats.push(`💚 +${item.heal}`);
    if (item.slot && item.slot !== '무기') stats.push(`📍 ${item.slot}`);
    // Stat bonuses
    if (item.stat_bonuses) {
      Object.entries(item.stat_bonuses).forEach(([k, v]) => {
        if (v && v > 0) stats.push(`${k} +${v}`);
      });
    }

    return `<div class="item-card" data-grade="${grade}" data-idx="${start + idx}" onclick="window.__openModal(${start + idx})">
      <div class="card-grade-bar"></div>
      <div class="card-body">
        <div class="card-grade">${grade}</div>
        <div class="card-name">${escHtml(item.name)}</div>
        <div class="card-desc">${escHtml(item.description || '')}</div>
        ${stats.length ? `<div class="card-stats">${stats.map(s => `<span class="card-stat">${s}</span>`).join('')}</div>` : ''}
        <div class="card-footer">
          <div class="card-price">${formatPrice(item.price)}<span class="currency">₩</span></div>
          <div class="card-type">${item.subcategory || item.category || ''}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderMonsterCard(item) {
  return `<div class="item-card monster-card" data-grade="${item.grade}" onclick="window.__openModal(${state.filteredItems.indexOf(item)})">
    <div class="card-grade-bar" style="background:${getGradeColor(item.grade)}"></div>
    <div class="card-body">
      <div class="card-grade" style="color:${getGradeColor(item.grade)}">${item.subcategory}</div>
      <div class="card-name" style="color:var(--red)">${escHtml(item.name)}</div>
      <div class="card-stats">
        <span class="card-stat">⚔️ ${item.attack_dice}</span>
        <span class="card-stat">🛡️ ${item.defense}</span>
        <span class="card-stat">❤️ ${item.hp}</span>
        <span class="card-stat">✨ ${item.exp_reward} EXP</span>
      </div>
      <div class="card-footer">
        <div class="card-type">몬스터</div>
        ${item.drops?.length ? `<div class="card-stat">드롭: ${item.drops[0].item}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// === PAGINATION ===
function renderPagination() {
  const container = document.getElementById('pagination');
  const totalPages = Math.ceil(state.filteredItems.length / state.perPage);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn ${state.page <= 1 ? 'disabled' : ''}" data-page="${state.page - 1}">◀</button>`;

  const range = 3;
  let start = Math.max(1, state.page - range);
  let end = Math.min(totalPages, state.page + range);
  if (start > 1) html += `<button class="page-btn" data-page="1">1</button><span class="page-info">...</span>`;
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  if (end < totalPages) html += `<span class="page-info">...</span><button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;

  html += `<button class="page-btn ${state.page >= totalPages ? 'disabled' : ''}" data-page="${state.page + 1}">▶</button>`;
  html += `<span class="page-info">${state.page}/${totalPages}</span>`;
  container.innerHTML = html;

  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (p >= 1 && p <= totalPages) {
        state.page = p;
        renderItems();
        renderPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

// === MODAL ===
window.__openModal = function (idx) {
  const item = state.filteredItems[idx];
  if (!item) return;
  const modal = document.getElementById('item-modal');
  const body = document.getElementById('modal-body');
  const grade = item.grade || '일반';
  const gradeColor = getGradeColor(grade);

  let statsHtml = '';
  if (item.category === '몬스터') {
    statsHtml = `
      <div class="modal-stat-card"><span class="modal-stat-label">ATTACK</span><span class="modal-stat-value" style="color:var(--red)">${item.attack_dice}</span></div>
      <div class="modal-stat-card"><span class="modal-stat-label">DEFENSE</span><span class="modal-stat-value">${item.defense}</span></div>
      <div class="modal-stat-card"><span class="modal-stat-label">HP</span><span class="modal-stat-value" style="color:var(--green)">${item.hp}</span></div>
      <div class="modal-stat-card"><span class="modal-stat-label">EXP</span><span class="modal-stat-value" style="color:var(--yellow)">${item.exp_reward}</span></div>`;
    if (item.drops?.length) {
      statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">DROP</span><span class="modal-stat-value" style="font-size:.8rem">${item.drops[0].item}</span></div>
        <div class="modal-stat-card"><span class="modal-stat-label">DROP RATE</span><span class="modal-stat-value">${item.drops[0].prob}%</span></div>`;
    }
  } else {
    if (item.dice) statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">DAMAGE</span><span class="modal-stat-value" style="color:var(--red)">${item.dice}</span></div>`;
    if (item.defense) statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">DEFENSE</span><span class="modal-stat-value">${item.defense}</span></div>`;
    if (item.bonus_hp) statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">BONUS HP</span><span class="modal-stat-value" style="color:var(--green)">+${item.bonus_hp}</span></div>`;
    if (item.heal) statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">HEAL</span><span class="modal-stat-value" style="color:var(--green)">+${item.heal}</span></div>`;
    if (item.slot) statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">SLOT</span><span class="modal-stat-value" style="font-size:.9rem">${item.slot}</span></div>`;
    if (item.weapon_type) statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">TYPE</span><span class="modal-stat-value" style="font-size:.9rem">${item.weapon_type}</span></div>`;
    if (item.stat_bonuses) {
      Object.entries(item.stat_bonuses).forEach(([k, v]) => {
        if (v && v > 0) statsHtml += `<div class="modal-stat-card"><span class="modal-stat-label">${k.toUpperCase()}</span><span class="modal-stat-value" style="color:var(--magenta)">+${v}</span></div>`;
      });
    }
  }

  // Build description - for monsters, create a custom description
  let descText = '';
  if (item.category === '몬스터') {
    descText = `게이트에서 출현하는 ${item.subcategory} 마물이다. 공격력 ${item.attack_dice}, 방어력 ${item.defense}, 체력 ${item.hp}. 처치 시 ${item.exp_reward} 경험치를 획득할 수 있다.`;
    if (item.drops?.length) {
      descText += ` 드롭 아이템: ${item.drops[0].item} (확률 ${item.drops[0].prob}%)`;
    }
  } else {
    descText = item.description || '';
  }

  body.innerHTML = `
    <div class="modal-grade-bar" style="background:${gradeColor}"></div>
    <div class="modal-header">
      <div class="modal-grade-label" style="color:${gradeColor}">${grade}</div>
      <div class="modal-name">${escHtml(item.name)}</div>
      <div class="modal-category">${item.category || ''} ${item.subcategory ? '▸ ' + item.subcategory : ''}</div>
    </div>
    <div class="modal-desc-section">
      <div class="modal-desc">${escHtml(descText)}</div>
    </div>
    ${statsHtml ? `<div class="modal-stats-grid">${statsHtml}</div>` : ''}
    <div class="modal-price-section">
      <div class="modal-price">${item.price ? formatFullPrice(item.price) : 'N/A'}</div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="window.__copyInfo(${idx})">📋 복사</button>
        ${state.isAdmin ? `<button class="btn-danger-sm" onclick="window.__deleteItem(${idx})" style="padding:10px 16px; font-size:0.8rem; margin-right:auto;">🗑️ 삭제</button>` : ''}
        ${item.price ? `<button class="btn-secondary" onclick="window.__addToCart(${idx})" style="color:var(--cyan);border-color:var(--cyan)">🛒 담기</button>
        <button class="btn-primary" onclick="window.__purchaseNow(${idx})">PURCHASE</button>` : ''}
      </div>
    </div>`;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.__copyInfo = function (idx) {
  const item = state.filteredItems[idx];
  if (!item) return;
  const text = `[${item.grade}] ${item.name}\n가격: ${formatFullPrice(item.price)}\n${item.description || ''}`;
  navigator.clipboard?.writeText(text).then(() => window.__toast('클립보드에 복사되었습니다.'));
};

window.__deleteItem = function (idx) {
  if (!state.isAdmin) return;
  const item = state.filteredItems[idx];
  if (!item) return;
  
  if (confirm(`정말 "${item.name}" 품목을 상점에서 삭제하시겠습니까?`)) {
    if (item._custom) {
      state.customItems = state.customItems.filter(ci => ci.id !== item.id);
      saveCustomData();
    } else {
      state.deletedItems.push(item.name);
      localStorage.setItem('bm_deleted_items', JSON.stringify(state.deletedItems));
    }
    
    closeModal();
    state.allItems = getAllItems();
    document.getElementById('total-items').textContent = state.allItems.length;
    applyFilters();
    renderNav();
    
    if (state.adminTab === 'products') {
      const body = document.getElementById('admin-body');
      if (body) renderProductsTab(body);
    }
    
    window.__toast(`"${item.name}" 품목이 삭제되었습니다.`);
  }
};

window.__toast = function (msg) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('out'); setTimeout(() => toast.remove(), 300); }, 2500);
};

function closeModal() {
  document.getElementById('item-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// === CART LOGIC ===
window.__addToCart = function (idx) {
  const item = state.filteredItems[idx];
  if (!item || !item.price) {
    window.__toast('이 품목은 장바구니에 담을 수 없습니다.');
    return;
  }
  const existing = state.cart.find(c => c.name === item.name);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ ...item, qty: 1 });
  }
  
  // Pulse animation
  const countEl = document.getElementById('cart-count');
  countEl.classList.remove('pulse');
  void countEl.offsetWidth; // trigger reflow
  countEl.classList.add('pulse');
  
  saveState();
  window.__toast(`${item.name} 장바구니에 추가됨.`);
  renderCartUI();
};

window.__updateCartQty = function (idx, delta) {
  if (!state.cart[idx]) return;
  state.cart[idx].qty += delta;
  if (state.cart[idx].qty <= 0) {
    state.cart.splice(idx, 1);
  }
  saveState();
  renderCartUI();
};

window.__removeFromCart = function (idx) {
  if (!state.cart[idx]) return;
  state.cart.splice(idx, 1);
  saveState();
  renderCartUI();
};

function renderCartUI() {
  const container = document.getElementById('cart-items-container');
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total-price');
  
  const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  countEl.textContent = totalItems;
  totalEl.textContent = formatPrice(totalPrice);
  
  if (state.cart.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🛒</div>
      <div class="empty-text">장바구니가 비어있습니다.</div>
    </div>`;
    return;
  }
  
  container.innerHTML = state.cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-grade" style="background:${getGradeColor(item.grade || '일반')}"></div>
      <div class="cart-item-info">
        <div class="cart-item-name" style="color:${getGradeColor(item.grade || '일반')}">${escHtml(item.name)}</div>
        <div class="cart-item-price">${formatFullPrice(item.price)} x ${item.qty}</div>
      </div>
      <div class="cart-item-actions">
        <button class="qty-btn" onclick="window.__updateCartQty(${idx}, -1)">-</button>
        <span class="cart-item-qty">${item.qty}</span>
        <button class="qty-btn" onclick="window.__updateCartQty(${idx}, 1)">+</button>
        <div class="cart-item-remove" onclick="window.__removeFromCart(${idx})">✕</div>
      </div>
    </div>
  `).join('');
}

function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    backdrop.classList.remove('visible');
  } else {
    drawer.classList.add('open');
    backdrop.classList.add('visible');
  }
}

// === PAYMENT LOGIC ===
window.__purchaseNow = function (idx) {
  if (!state.currentUser) {
    window.__toast('결제를 진행하려면 먼저 로그인해 주세요.');
    openLoginModal();
    return;
  }
  const item = state.filteredItems[idx];
  if (!item || !item.price) {
    window.__toast('이 품목은 구매할 수 없습니다.');
    return;
  }
  closeModal();
  
  state.cart = [{ ...item, qty: 1 }];
  saveState();
  renderCartUI();
  
  openPaymentModal(item.price);
};

function openPaymentModal(amount) {
  if (!state.currentUser) {
    window.__toast('결제를 진행하려면 먼저 로그인해 주세요.');
    openLoginModal();
    return;
  }
  if (amount <= 0) {
    window.__toast('결제 금액이 없습니다.');
    return;
  }
  
  // Close cart if open
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-drawer-backdrop').classList.remove('visible');

  // Toss Payments Init
  const clientKey = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';
  const tossPayments = TossPayments(clientKey);
  
  const orderId = 'TRX-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const orderName = state.cart.length > 1 
    ? `${state.cart[0].name} 외 ${state.cart.length - 1}건` 
    : (state.cart[0]?.name || '흑시장 품목');

  tossPayments.requestPayment('카드', {
    amount: amount,
    orderId: orderId,
    orderName: orderName,
    customerName: '네오서울 사이버러너',
    successUrl: window.location.origin + window.location.pathname + '?paymentSuccess=true&orderId=' + orderId,
    failUrl: window.location.origin + window.location.pathname + '?paymentFail=true',
  }).catch(function (error) {
    if (error.code === 'USER_CANCEL') {
      window.__toast('결제를 취소했습니다.');
    } else {
      window.__toast('결제 오류: ' + error.message);
    }
  });
}

// === ORDER HISTORY LOGIC ===
function openOrdersModal() {
  renderOrdersUI();
  document.getElementById('orders-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeOrdersModal() {
  document.getElementById('orders-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function renderOrdersUI() {
  const container = document.getElementById('orders-container');
  if (state.orders.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📜</div>
      <div class="empty-text">주문 내역이 없습니다.</div>
    </div>`;
    return;
  }
  
  container.innerHTML = state.orders.map(order => `
    <div class="order-card">
      <div class="order-card-header">
        <span class="order-id">${order.id}</span>
        <span class="order-date">${order.date}</span>
      </div>
      <div class="order-card-items">
        ${order.items.map(item => `
          <div class="order-item">
            <span class="order-item-name">${escHtml(item.name)}</span>
            <span class="order-item-qty">x${item.qty}</span>
            <span class="order-item-price">${formatPrice(item.price * item.qty)}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-card-footer">
        <span class="order-status">${order.status}</span>
        <span class="order-total">${formatFullPrice(order.total)}</span>
      </div>
    </div>
  `).join('');
}

// === AUTH LOGIC ===
function openLoginModal() {
  document.getElementById('login-modal').style.display = 'flex';
}

function closeLoginModal() {
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('login-id').value = '';
  document.getElementById('login-pw').value = '';
}

function handleLogin() {
  const idInput = document.getElementById('login-id').value.trim();
  const pwInput = document.getElementById('login-pw').value;
  if (!idInput || !pwInput) {
    window.__toast('아이디와 비밀번호를 모두 입력하세요.');
    return;
  }
  
  if (state.users[idInput]) {
    if (state.users[idInput].password !== pwInput) {
      window.__toast('비밀번호가 일치하지 않습니다.');
      return;
    }
  } else {
    state.users[idInput] = { password: pwInput, cart: [], orders: [], joinDate: new Date().toISOString() };
    window.__toast('새 계정이 등록되었습니다.');
  }
  
  state.currentUser = idInput;
  state.isAdmin = (idInput === 'admin');
  localStorage.setItem('bm_currentUser', idInput);
  localStorage.setItem('bm_users', JSON.stringify(state.users));
  
  loadUserData();
  updateAuthUI();
  closeLoginModal();
  window.__toast(`환영합니다, ${idInput}님.${state.isAdmin ? ' [관리자 모드]' : ''}`);
}

async function handleGoogleLogin() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) {
      window.__toast('Google 로그인 오류: ' + error.message);
    }
  } catch (err) {
    window.__toast('Google 로그인 연결 실패: ' + err.message);
  }
}

async function initSupabaseAuth() {
  // Check current session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    handleSupabaseSession(session.user);
  }
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      handleSupabaseSession(session.user);
    } else if (event === 'SIGNED_OUT') {
      // Don't override local auth
    }
  });
}

function handleSupabaseSession(user) {
  state.supabaseUser = user;
  const displayName = user.user_metadata?.full_name || user.email || 'Google User';
  const userId = 'google_' + (user.email || user.id);
  
  // Register in local users if not exists
  if (!state.users[userId]) {
    state.users[userId] = { 
      password: null, 
      cart: [], 
      orders: [], 
      joinDate: new Date().toISOString(),
      email: user.email,
      displayName: displayName,
      provider: 'google',
      avatar: user.user_metadata?.avatar_url
    };
  }
  
  state.currentUser = userId;
  state.isAdmin = false; // Google users are not admins by default
  localStorage.setItem('bm_currentUser', userId);
  localStorage.setItem('bm_users', JSON.stringify(state.users));
  
  loadUserData();
  updateAuthUI();
  closeLoginModal();
  window.__toast(`환영합니다, ${displayName}님.`);
}

function handleLogout() {
  // Also sign out from Supabase if logged in via Google
  if (state.supabaseUser) {
    supabase.auth.signOut();
    state.supabaseUser = null;
  }
  state.currentUser = null;
  state.isAdmin = false;
  state.cart = [];
  state.orders = [];
  localStorage.removeItem('bm_currentUser');
  updateAuthUI();
  renderCartUI();
  window.__toast('로그아웃 되었습니다.');
}

function loadUserData() {
  if (state.currentUser && state.users[state.currentUser]) {
    state.cart = state.users[state.currentUser].cart || [];
    state.orders = state.users[state.currentUser].orders || [];
  } else {
    state.cart = [];
    state.orders = [];
  }
  renderCartUI();
}

function updateAuthUI() {
  const authArea = document.getElementById('auth-area');
  if (state.currentUser) {
    const userData = state.users[state.currentUser];
    const displayName = userData?.displayName || state.currentUser;
    const isGoogle = userData?.provider === 'google';
    const avatarHtml = userData?.avatar 
      ? `<img src="${userData.avatar}" class="user-avatar" alt="avatar"/>`
      : '';
    
    authArea.innerHTML = `
      <div class="stat-item" style="margin-right:8px;">
        <span class="stat-label">ID</span>
        <span class="stat-value" style="color:var(--cyan);text-transform:none;display:flex;align-items:center;gap:4px;">
          ${avatarHtml}
          ${escHtml(displayName)}
          ${isGoogle ? '<span style="font-size:.5rem;color:var(--green);">GOOGLE</span>' : ''}
        </span>
      </div>
      ${state.isAdmin ? `<button class="header-icon-btn admin-panel-btn" id="admin-panel-btn">
        <span class="header-icon">⚙️</span>
        <span class="header-icon-text">관리자</span>
      </button>` : ''}
      <button class="header-icon-btn" id="logout-btn">
        <span class="header-icon">🚪</span>
        <span class="header-icon-text">로그아웃</span>
      </button>
    `;
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    if (state.isAdmin) {
      document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
    }
  } else {
    authArea.innerHTML = `
      <button class="header-icon-btn" id="login-btn">
        <span class="header-icon">🔑</span>
        <span class="header-icon-text">로그인</span>
      </button>
    `;
    document.getElementById('login-btn').addEventListener('click', openLoginModal);
  }
}

// ============================================
// === ADMIN PANEL ===
// ============================================

function openAdminPanel() {
  if (!state.isAdmin) return;
  document.getElementById('admin-panel').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  state.adminTab = 'dashboard';
  renderAdminTab('dashboard');
  // Set active tab
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.admin-tab[data-tab="dashboard"]')?.classList.add('active');
}

function closeAdminPanel() {
  document.getElementById('admin-panel').style.display = 'none';
  document.body.style.overflow = '';
}

function renderAdminTab(tab) {
  state.adminTab = tab;
  state.memberDetailId = null;
  const body = document.getElementById('admin-body');
  switch (tab) {
    case 'dashboard': renderDashboard(body); break;
    case 'products': renderProductsTab(body); break;
    case 'members': renderMembersTab(body); break;
    case 'revenue': renderRevenueTab(body); break;
  }
}

// === DASHBOARD ===
function getAllOrders() {
  const allOrders = [];
  Object.entries(state.users).forEach(([userId, userData]) => {
    if (userData.orders) {
      userData.orders.forEach(order => {
        allOrders.push({ ...order, userId });
      });
    }
  });
  return allOrders;
}

function getTodayOrders() {
  const today = new Date().toLocaleDateString('ko-KR');
  return getAllOrders().filter(o => {
    try {
      const orderDate = new Date(o.date).toLocaleDateString('ko-KR');
      return orderDate === today;
    } catch { return false; }
  });
}

function getMonthlyRevenue() {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  return getAllOrders()
    .filter(o => {
      try {
        const d = new Date(o.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      } catch { return false; }
    })
    .reduce((sum, o) => sum + (o.total || 0), 0);
}

function renderDashboard(container) {
  const allItems = getAllItems();
  const totalMembers = Object.keys(state.users).length;
  const todayOrders = getTodayOrders();
  const monthlyRevenue = getMonthlyRevenue();
  const allOrders = getAllOrders();
  const isOnline = navigator.onLine;

  // Recent orders (last 10)
  const recentOrders = allOrders.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  container.innerHTML = `
    <div class="dash-cards">
      <div class="dash-card ${isOnline ? 'online' : 'offline'}">
        <div class="dash-card-icon">🖥️</div>
        <div class="dash-card-label">서버 상태</div>
        <div class="dash-card-value ${isOnline ? 'status-online' : 'status-offline'}">${isOnline ? 'ONLINE' : 'OFFLINE'}</div>
        <div class="dash-card-sub">${isOnline ? 'TOR NODE 7X-KR 연결됨' : '연결 끊김'}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">📦</div>
        <div class="dash-card-label">판매항목 수</div>
        <div class="dash-card-value">${allItems.length.toLocaleString()}</div>
        <div class="dash-card-sub">기본 ${(allItems.length - state.customItems.length).toLocaleString()} + 커스텀 ${state.customItems.length}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">👥</div>
        <div class="dash-card-label">전체 회원 수</div>
        <div class="dash-card-value">${totalMembers.toLocaleString()}</div>
        <div class="dash-card-sub">활성 사용자</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">📋</div>
        <div class="dash-card-label">오늘 신청</div>
        <div class="dash-card-value">${todayOrders.length}</div>
        <div class="dash-card-sub">${new Date().toLocaleDateString('ko-KR')}</div>
      </div>
      <div class="dash-card highlight">
        <div class="dash-card-icon">💰</div>
        <div class="dash-card-label">당월 매출</div>
        <div class="dash-card-value">${formatPrice(monthlyRevenue)}<span class="dash-currency">₩</span></div>
        <div class="dash-card-sub">${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월</div>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 최근 주문 // RECENT ORDERS</div>
      ${recentOrders.length === 0 ? '<div class="admin-empty">주문 내역이 없습니다.</div>' : `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>주문ID</th><th>회원</th><th>일시</th><th>품목수</th><th>금액</th><th>상태</th></tr>
            </thead>
            <tbody>
              ${recentOrders.map(o => `
                <tr>
                  <td class="mono">${o.id}</td>
                  <td>${escHtml(o.userId)}</td>
                  <td class="mono">${o.date}</td>
                  <td>${o.items?.length || 0}</td>
                  <td class="price">${formatFullPrice(o.total)}</td>
                  <td><span class="status-badge">${o.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// === PRODUCTS TAB ===
function renderProductsTab(container) {
  const catTree = buildCategoryTree();
  const defaultCats = ['무기', '방어구', '사이버웨어', '소모품', '소재', '몬스터', '기타'];
  const allCats = [...defaultCats];
  state.customCategories.forEach(cc => {
    if (!allCats.includes(cc.name)) allCats.push(cc.name);
  });

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">▸ 카테고리 관리 // CATEGORIES</div>
      <div class="admin-form-row">
        <input type="text" id="new-cat-name" placeholder="카테고리명" class="admin-input" />
        <input type="text" id="new-cat-icon" placeholder="이모지 (예: 🔮)" class="admin-input small" maxlength="4" />
        <button class="btn-primary btn-sm" id="add-cat-btn">+ 추가</button>
      </div>
      <div class="admin-chips" id="cat-chips">
        ${state.customCategories.map((cc, i) => `
          <div class="admin-chip">
            <span>${cc.icon} ${cc.name}</span>
            <button class="chip-remove" data-idx="${i}">✕</button>
          </div>
        `).join('')}
        ${state.customCategories.length === 0 ? '<div class="admin-empty-small">커스텀 카테고리가 없습니다.</div>' : ''}
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 판매항목 추가 // ADD ITEM</div>
      <div class="admin-form" id="add-item-form">
        <div class="admin-form-grid">
          <div class="admin-field">
            <label>상품명 *</label>
            <input type="text" id="item-name" placeholder="상품 이름" class="admin-input" />
          </div>
          <div class="admin-field">
            <label>카테고리 *</label>
            <select id="item-category" class="admin-input">
              ${allCats.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="admin-field">
            <label>서브카테고리</label>
            <input type="text" id="item-subcategory" placeholder="서브카테고리" class="admin-input" />
          </div>
          <div class="admin-field">
            <label>가격 (₩) *</label>
            <input type="number" id="item-price" placeholder="10000" class="admin-input" />
          </div>
          <div class="admin-field">
            <label>등급</label>
            <select id="item-grade" class="admin-input">
              <option value="일반">일반</option>
              <option value="중고">중고</option>
              <option value="시장제">시장제</option>
              <option value="명품">명품</option>
              <option value="군용">군용</option>
              <option value="기업제">기업제</option>
              <option value="프로토타입">프로토타입</option>
            </select>
          </div>
          <div class="admin-field">
            <label>타입</label>
            <select id="item-type" class="admin-input">
              <option value="무기">무기</option>
              <option value="방어구">방어구</option>
              <option value="소모품">소모품</option>
              <option value="사이버웨어">사이버웨어</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>
        <div class="admin-field full">
          <label>설명</label>
          <textarea id="item-desc" placeholder="상품 설명을 입력하세요..." class="admin-input admin-textarea"></textarea>
        </div>
        <div class="admin-form-grid">
          <div class="admin-field">
            <label>공격력 (주사위)</label>
            <input type="text" id="item-dice" placeholder="예: 2d6+3" class="admin-input" />
          </div>
          <div class="admin-field">
            <label>방어력</label>
            <input type="number" id="item-defense" placeholder="0" class="admin-input" />
          </div>
          <div class="admin-field">
            <label>보너스 HP</label>
            <input type="number" id="item-bonus-hp" placeholder="0" class="admin-input" />
          </div>
          <div class="admin-field">
            <label>회복량</label>
            <input type="number" id="item-heal" placeholder="0" class="admin-input" />
          </div>
        </div>
        <button class="btn-primary" id="add-item-btn" style="margin-top:12px;">📦 상품 등록</button>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 등록된 커스텀 상품 // CUSTOM ITEMS (${state.customItems.length})</div>
      ${state.customItems.length === 0 ? '<div class="admin-empty">등록된 커스텀 상품이 없습니다.</div>' : `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>이름</th><th>카테고리</th><th>등급</th><th>가격</th><th>관리</th></tr>
            </thead>
            <tbody>
              ${state.customItems.map((item, i) => `
                <tr>
                  <td>${escHtml(item.name)}</td>
                  <td>${item.category} ${item.subcategory ? '▸ ' + item.subcategory : ''}</td>
                  <td><span style="color:${getGradeColor(item.grade)}">${item.grade}</span></td>
                  <td class="price">${formatFullPrice(item.price)}</td>
                  <td><button class="btn-danger-sm" data-delete-item="${i}">삭제</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Event listeners
  document.getElementById('add-cat-btn')?.addEventListener('click', () => {
    const name = document.getElementById('new-cat-name').value.trim();
    const icon = document.getElementById('new-cat-icon').value.trim() || '📁';
    if (!name) { window.__toast('카테고리명을 입력하세요.'); return; }
    if (state.customCategories.some(c => c.name === name)) { window.__toast('이미 존재하는 카테고리입니다.'); return; }
    state.customCategories.push({ name, icon });
    saveCustomData();
    renderNav();
    renderProductsTab(container);
    window.__toast(`카테고리 "${name}" 추가됨.`);
  });

  document.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const removed = state.customCategories.splice(idx, 1);
      saveCustomData();
      renderNav();
      renderProductsTab(container);
      window.__toast(`카테고리 "${removed[0]?.name}" 삭제됨.`);
    });
  });

  document.getElementById('add-item-btn')?.addEventListener('click', () => {
    const name = document.getElementById('item-name').value.trim();
    const category = document.getElementById('item-category').value;
    const subcategory = document.getElementById('item-subcategory').value.trim();
    const price = parseInt(document.getElementById('item-price').value) || 0;
    const grade = document.getElementById('item-grade').value;
    const type = document.getElementById('item-type').value;
    const description = document.getElementById('item-desc').value.trim();
    const dice = document.getElementById('item-dice').value.trim();
    const defense = parseInt(document.getElementById('item-defense').value) || 0;
    const bonusHp = parseInt(document.getElementById('item-bonus-hp').value) || 0;
    const heal = parseInt(document.getElementById('item-heal').value) || 0;

    if (!name) { window.__toast('상품명을 입력하세요.'); return; }
    if (!price) { window.__toast('가격을 입력하세요.'); return; }

    const gradeRanks = { '중고': 1, '시장제': 2, '명품': 3, '군용': 4, '기업제': 5, '프로토타입': 6, '일반': 0 };
    
    const newItem = {
      id: 'custom_' + Date.now(),
      name, category, subcategory: subcategory || '미분류', price, grade,
      gradeRank: gradeRanks[grade] || 0,
      type, description,
      dice: dice || undefined,
      defense: defense || undefined,
      bonus_hp: bonusHp || undefined,
      heal: heal || undefined,
    };

    state.customItems.push(newItem);
    saveCustomData();
    state.allItems = getAllItems();
    document.getElementById('total-items').textContent = state.allItems.length;
    renderNav();
    applyFilters();
    renderProductsTab(container);
    window.__toast(`"${name}" 상품이 등록되었습니다.`);
  });

  document.querySelectorAll('[data-delete-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.deleteItem);
      const removed = state.customItems.splice(idx, 1);
      saveCustomData();
      state.allItems = getAllItems();
      document.getElementById('total-items').textContent = state.allItems.length;
      renderNav();
      applyFilters();
      renderProductsTab(container);
      window.__toast(`"${removed[0]?.name}" 삭제됨.`);
    });
  });
}

// === MEMBERS TAB ===
function renderMembersTab(container) {
  if (state.memberDetailId) {
    renderMemberDetail(container, state.memberDetailId);
    return;
  }

  const members = Object.entries(state.users).map(([id, data]) => {
    const orderCount = data.orders?.length || 0;
    const totalSpend = data.orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    return { id, ...data, orderCount, totalSpend };
  });

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">▸ 전체 회원 목록 // MEMBERS (${members.length})</div>
      ${members.length === 0 ? '<div class="admin-empty">등록된 회원이 없습니다.</div>' : `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>회원 ID</th><th>가입 유형</th><th>가입일</th><th>주문 수</th><th>총 구매액</th><th>상세</th></tr>
            </thead>
            <tbody>
              ${members.map(m => `
                <tr>
                  <td class="mono">${escHtml(m.id)}</td>
                  <td>${m.provider === 'google' ? '<span class="badge-google">Google</span>' : '<span class="badge-local">로컬</span>'}</td>
                  <td class="mono">${m.joinDate ? new Date(m.joinDate).toLocaleDateString('ko-KR') : '-'}</td>
                  <td>${m.orderCount}</td>
                  <td class="price">${formatFullPrice(m.totalSpend)}</td>
                  <td><button class="btn-detail" data-member-id="${m.id}">조회</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  document.querySelectorAll('[data-member-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.memberDetailId = btn.dataset.memberId;
      renderMembersTab(container);
    });
  });
}

function renderMemberDetail(container, userId) {
  const userData = state.users[userId];
  if (!userData) {
    state.memberDetailId = null;
    renderMembersTab(container);
    return;
  }

  const orders = userData.orders || [];
  const totalSpend = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const cartItems = userData.cart || [];

  container.innerHTML = `
    <div class="admin-section">
      <button class="btn-back" id="member-back">← 목록으로</button>
      <div class="member-detail-header">
        <div class="member-avatar-big">${userData.avatar ? `<img src="${userData.avatar}" />` : '👤'}</div>
        <div class="member-info">
          <div class="member-detail-name">${escHtml(userData.displayName || userId)}</div>
          <div class="member-detail-meta">
            ${userData.email ? `<span>📧 ${userData.email}</span>` : ''}
            <span>📅 가입: ${userData.joinDate ? new Date(userData.joinDate).toLocaleDateString('ko-KR') : '알 수 없음'}</span>
            <span>${userData.provider === 'google' ? '🔗 Google 계정' : '🔑 로컬 계정'}</span>
          </div>
        </div>
      </div>

      <div class="member-stats-row">
        <div class="member-stat-card">
          <div class="member-stat-label">총 주문</div>
          <div class="member-stat-value">${orders.length}건</div>
        </div>
        <div class="member-stat-card">
          <div class="member-stat-label">총 구매액</div>
          <div class="member-stat-value">${formatFullPrice(totalSpend)}</div>
        </div>
        <div class="member-stat-card">
          <div class="member-stat-label">장바구니</div>
          <div class="member-stat-value">${cartItems.length}개</div>
        </div>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 구매 내역 // PURCHASE HISTORY</div>
      ${orders.length === 0 ? '<div class="admin-empty">구매 내역이 없습니다.</div>' : `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>주문 ID</th><th>일시</th><th>품목</th><th>금액</th><th>상태</th></tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr>
                  <td class="mono">${o.id}</td>
                  <td class="mono">${o.date}</td>
                  <td>${o.items?.map(i => escHtml(i.name) + ' x' + i.qty).join(', ') || '-'}</td>
                  <td class="price">${formatFullPrice(o.total)}</td>
                  <td><span class="status-badge">${o.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  document.getElementById('member-back')?.addEventListener('click', () => {
    state.memberDetailId = null;
    renderMembersTab(container);
  });
}

// === REVENUE TAB ===
function renderRevenueTab(container) {
  const allOrders = getAllOrders();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  // Monthly revenue for last 12 months
  const monthlyData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const month = d.getMonth();
    const year = d.getFullYear();
    const label = `${year}.${String(month + 1).padStart(2, '0')}`;
    const revenue = allOrders
      .filter(o => {
        try {
          const od = new Date(o.date);
          return od.getMonth() === month && od.getFullYear() === year;
        } catch { return false; }
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const orderCount = allOrders.filter(o => {
      try {
        const od = new Date(o.date);
        return od.getMonth() === month && od.getFullYear() === year;
      } catch { return false; }
    }).length;
    monthlyData.push({ label, revenue, orderCount });
  }

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  // Daily revenue for current month
  const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
  const dailyData = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOrders = allOrders.filter(o => {
      try {
        const od = new Date(o.date);
        return od.getDate() === d && od.getMonth() === thisMonth && od.getFullYear() === thisYear;
      } catch { return false; }
    });
    dailyData.push({
      day: d,
      revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      orders: dayOrders.length
    });
  }
  const maxDailyRevenue = Math.max(...dailyData.map(d => d.revenue), 1);

  // Category breakdown
  const categoryRevenue = {};
  allOrders.forEach(o => {
    if (o.items) {
      o.items.forEach(item => {
        const cat = item.category || '기타';
        if (!categoryRevenue[cat]) categoryRevenue[cat] = 0;
        categoryRevenue[cat] += (item.price || 0) * (item.qty || 1);
      });
    }
  });
  const totalCatRevenue = Object.values(categoryRevenue).reduce((a, b) => a + b, 0) || 1;
  const catEntries = Object.entries(categoryRevenue).sort((a, b) => b[1] - a[1]);

  // Totals
  const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrderCount = allOrders.length;

  container.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">▸ 매출 요약 // REVENUE SUMMARY</div>
      <div class="revenue-summary-cards">
        <div class="revenue-card">
          <div class="revenue-card-label">총 매출</div>
          <div class="revenue-card-value">${formatFullPrice(totalRevenue)}</div>
        </div>
        <div class="revenue-card">
          <div class="revenue-card-label">총 주문 수</div>
          <div class="revenue-card-value">${totalOrderCount}건</div>
        </div>
        <div class="revenue-card">
          <div class="revenue-card-label">평균 주문 금액</div>
          <div class="revenue-card-value">${totalOrderCount > 0 ? formatFullPrice(Math.round(totalRevenue / totalOrderCount)) : '-'}</div>
        </div>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 월별 매출 추이 // MONTHLY TREND (12개월)</div>
      <div class="chart-container">
        ${monthlyData.map(m => `
          <div class="chart-bar-group">
            <div class="chart-bar-value">${formatPrice(m.revenue)}</div>
            <div class="chart-bar" style="height:${Math.max((m.revenue / maxRevenue) * 160, 2)}px"></div>
            <div class="chart-bar-label">${m.label.split('.')[1]}월</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 일별 매출 // DAILY (${thisMonth + 1}월)</div>
      <div class="chart-container daily-chart">
        ${dailyData.map(d => `
          <div class="chart-bar-group mini">
            <div class="chart-bar mini-bar" style="height:${Math.max((d.revenue / maxDailyRevenue) * 100, 1)}px" title="${d.day}일: ${formatFullPrice(d.revenue)} (${d.orders}건)"></div>
            <div class="chart-bar-label mini-label">${d.day}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 카테고리별 매출 // BY CATEGORY</div>
      ${catEntries.length === 0 ? '<div class="admin-empty">매출 데이터가 없습니다.</div>' : `
        <div class="category-breakdown">
          ${catEntries.map(([cat, rev]) => {
            const pct = ((rev / totalCatRevenue) * 100).toFixed(1);
            return `
              <div class="cat-rev-row">
                <span class="cat-rev-name">${categoryIcons[cat] || '📦'} ${cat}</span>
                <div class="cat-rev-bar-wrap">
                  <div class="cat-rev-bar" style="width:${pct}%"></div>
                </div>
                <span class="cat-rev-value">${formatPrice(rev)}₩</span>
                <span class="cat-rev-pct">${pct}%</span>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <div class="admin-section">
      <div class="admin-section-title">▸ 월별 정산 테이블 // SETTLEMENT</div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>월</th><th>주문 수</th><th>매출</th></tr>
          </thead>
          <tbody>
            ${monthlyData.map(m => `
              <tr>
                <td class="mono">${m.label}</td>
                <td>${m.orderCount}건</td>
                <td class="price">${formatFullPrice(m.revenue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// === INIT ===
function init() {
  state.allItems = getAllItems();

  // Check admin status from stored user
  if (state.currentUser === 'admin') {
    state.isAdmin = true;
  }

  // Update initial UI
  updateAuthUI();
  loadUserData();

  // Initialize Supabase Auth
  initSupabaseAuth();

  // Check Toss Payments Callback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('paymentSuccess') === 'true') {
    const orderId = urlParams.get('orderId') || 'TRX-UNKNOWN';
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const date = new Date().toLocaleString('ko-KR');
    
    if (state.cart.length > 0) {
      state.orders.unshift({
        id: orderId,
        date: date,
        items: [...state.cart],
        total: total,
        status: '결제 완료'
      });
      state.cart = [];
      saveState();
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setTimeout(() => {
        window.__toast('결제 승인됨. 배송 드론이 곧 좌표로 이동합니다.');
      }, 500);
    }
  } else if (urlParams.get('paymentFail') === 'true') {
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      window.__toast('결제가 실패하거나 취소되었습니다.');
    }, 500);
  }

  // Stats
  document.getElementById('total-items').textContent = state.allItems.length;

  renderNav();
  renderBreadcrumb();
  renderGradeFilters();
  applyFilters();

  // Search
  const searchInput = document.getElementById('search-input');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = searchInput.value.trim();
      state.page = 1;
      applyFilters();
    }, 300);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchInput.value = ''; state.searchQuery = ''; state.page = 1; applyFilters(); searchInput.blur(); }
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    state.page = 1;
    applyFilters();
  });

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.viewMode = btn.dataset.view;
      renderItems();
    });
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('item-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeOrdersModal();
      closeLoginModal();
      closeAdminPanel();
      if (document.getElementById('cart-drawer').classList.contains('open')) toggleCart();
    }
  });

  // Auth Event Listeners
  document.getElementById('login-close').addEventListener('click', closeLoginModal);
  document.getElementById('login-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLoginModal();
  });
  document.getElementById('login-submit-btn').addEventListener('click', handleLogin);
  document.getElementById('login-pw').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Google Login
  document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);

  // Cart & Orders Event Listeners
  document.getElementById('orders-toggle-btn').addEventListener('click', openOrdersModal);
  document.getElementById('orders-close').addEventListener('click', closeOrdersModal);
  document.getElementById('orders-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeOrdersModal();
  });

  document.getElementById('cart-toggle-btn').addEventListener('click', toggleCart);
  document.getElementById('cart-close').addEventListener('click', toggleCart);
  document.getElementById('cart-drawer-backdrop').addEventListener('click', toggleCart);
  
  document.getElementById('cart-checkout-btn').addEventListener('click', () => {
    const totalPrice = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    openPaymentModal(totalPrice);
  });

  // Mobile menu button (hamburger)
  document.getElementById('mobile-menu-btn').addEventListener('click', openMobileSidebar);

  // Sidebar close button (✕ inside sidebar)
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      closeMobileSidebar();
    } else {
      document.getElementById('sidebar').classList.toggle('collapsed');
    }
  });

  // Backdrop click closes sidebar
  document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileSidebar);

  // Logo click -> home
  document.getElementById('logo-area').addEventListener('click', () => {
    state.currentCategory = null;
    state.currentSubcategory = null;
    state.searchQuery = '';
    searchInput.value = '';
    state.gradeFilters.clear();
    state.page = 1;
    renderNav();
    renderBreadcrumb();
    renderGradeFilters();
    applyFilters();
  });

  // Keyboard shortcut for search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Admin Panel Event Listeners
  document.getElementById('admin-close')?.addEventListener('click', closeAdminPanel);
  document.getElementById('admin-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.admin-tab');
    if (!tab) return;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderAdminTab(tab.dataset.tab);
  });
}

init();
