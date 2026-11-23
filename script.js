/* 상품 정보는 Supabase의 public.shop_products 표에서 불러옵니다. */
let PRODUCTS = [];

const MEMBER_TIERS = [
  { grade: "WELCOME", name: "스위트", min: 0, rate: 1 },
  { grade: "SILVER", name: "베이직", min: 30000, rate: 3 },
  { grade: "GOLD", name: "플래티넘", min: 100000, rate: 5 },
  { grade: "VIP", name: "VIP", min: 300000, rate: 7 }
];

const HEROES = [
  {image:"img/hero-1.jpg",title:"반짝이는 일상 속,<br>작은 행복 ♡",text:"지금, 키링과 함께해요!"},
  {image:"img/hero-2.jpg",title:"오늘의 가방에<br>작은 포인트를",text:"취향을 담은 리본 키링"},
  {image:"img/hero-3.jpg",title:"your little<br>happy moment ♡",text:"매일 함께하고 싶은 귀여움"},
  {image:"img/hero-4.jpg",title:"귀여움을 달고<br>오늘도 반짝!",text:"keyring에서 만나보세요"}
];

const $ = (selector) => document.querySelector(selector);
const money = (value) => `${Number(value).toLocaleString("ko-KR")}원`;
const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[char]));


// 이전 데모 버전이 저장했던 회원정보·비밀번호를 한 번 정리합니다.
function clearLegacyMemberStorage(){

  localStorage.removeItem("keyringUser");
  localStorage.removeItem("keyringRegisteredIds");

  const oldAccountKeys = [];

  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);

    if (key && key.startsWith("keyringAccount_")) {
      oldAccountKeys.push(key);
    }
  }

  oldAccountKeys.forEach(key => localStorage.removeItem(key));

}

clearLegacyMemberStorage();


// 회원 정보는 Supabase Auth와 shop_profiles에서만 가져옵니다.
let currentAuthUser = null;
let currentUser = null;
let profileLoadSequence = 0;

// 장바구니와 체험 주문 내역은 기존 방식대로 브라우저에 보관합니다.
let cart = load("keyringCart", []);
let orders = load("keyringOrders", []);

let selectedCategory = "전체";
let searchTerm = "";
let slideIndex = 0;
let slideTimer;
let toastTimer;


// ========================================
// 1. Supabase에서 상품 불러오기
// ========================================

async function loadProductsFromDatabase(){

  if (!window.db) {
    console.error("Supabase 연결 객체 db를 찾을 수 없습니다. index.html의 CDN → db.js → script.js 순서를 확인해주세요.");
    return;
  }

  const { data, error } = await window.db
    .from("shop_products")
    .select("id, name, category, price, stock, image_url, is_active")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) {

    console.error(error.message);

    $("#productGrid").innerHTML = "";
    $("#resultCount").textContent = "0개 상품";
    $("#emptyState").textContent = "상품을 불러오지 못했어요.";
    $("#emptyState").hidden = false;

    return;
  }

  PRODUCTS = (data || []).map(product => ({
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    stock: Number(product.stock)
  }));

  renderCategoryFilters();
  renderProducts();

}


// ========================================
// 2. 공통 기능 및 화면 표시
// ========================================

function saveState(){

  // 회원 정보나 비밀번호는 저장하지 않습니다.
  localStorage.setItem("keyringCart", JSON.stringify(cart));
  localStorage.setItem("keyringOrders", JSON.stringify(orders));

}

function showToast(message){

  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(
    () => toast.classList.remove("show"),
    2200
  );

}

function currentTier(user = currentUser){

  if (!user) return MEMBER_TIERS[0];

  return MEMBER_TIERS.find(
    tier => tier.grade === user.grade
  ) || MEMBER_TIERS[0];

}

function renderTiers(){

  $("#tierList").innerHTML = MEMBER_TIERS.map(tier =>
    `<div class="tier-row"><b>${tier.name}</b><span>${tier.rate}% 적립</span></div>`
  ).join("");

}


// 상단 메뉴에 로그인 상태를 표시합니다.
function ensureAuthMenu(){

  const nav = $(".main-nav");

  if (!nav || $("#authMenuAction")) return;

  const menu = document.createElement("a");

  menu.href = "#";
  menu.className = "nav-link";
  menu.id = "authMenuAction";

  nav.appendChild(menu);

}

function renderAuthMenu(){

  const menu = $("#authMenuAction");

  if (!menu) return;

  if (currentAuthUser) {

    const name = currentUser?.name || currentAuthUser.user_metadata?.name || "회원";

    menu.textContent = `${name} 님 · 로그아웃`;

    menu.setAttribute("aria-label", `${name} 로그아웃`);

  } else {

    menu.textContent = "로그인 · 회원가입";

    menu.setAttribute("aria-label", "로그인 또는 회원가입");

  }

}


// ========================================
// 3. Supabase 회원 정보 및 로그인 상태
// ========================================

async function loadMyProfile(authUser, showError = false){

  const requestNumber = ++profileLoadSequence;

  currentAuthUser = authUser || null;

  if (!authUser) {

    currentUser = null;

    renderAuthMenu();
    renderProducts();

    return null;

  }

  try {

    const { data, error } = await window.db
      .from("shop_profiles")
      .select("id, email, name, phone, grade, points, role")
      .eq("id", authUser.id)
      .single();

    if (requestNumber !== profileLoadSequence) return null;

    if (error) {

      console.error(error.message);

      currentUser = null;

      renderAuthMenu();

      if (showError) {
        showToast("회원 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }

      return null;

    }

    currentUser = data;

    renderAuthMenu();
    renderProducts();

    return data;

  } catch (error) {

    console.error(error?.message ?? error);

    currentUser = null;

    renderAuthMenu();

    if (showError) {
      showToast("회원 정보를 불러오지 못했어요. 인터넷 연결을 확인해주세요.");
    }

    return null;

  }

}


function initializeSupabaseAuth(){

  if (!window.db?.auth) {

    console.error("Supabase Auth를 사용할 수 없습니다. db.js와 Supabase CDN 연결을 확인해주세요.");

    showToast("로그인 서비스를 불러오지 못했어요.");

    return;

  }

  window.db.auth.getSession().then(({ data, error }) => {

    if (error) {

      console.error(error.message);

      showToast("로그인 상태를 확인하지 못했어요.");

      return;

    }

    loadMyProfile(data.session?.user || null);

  });


  window.db.auth.onAuthStateChange((_event, session) => {

    setTimeout(() => {
      loadMyProfile(session?.user || null);
    }, 0);

  });

}


function authErrorMessage(error, action){

  const message = String(error?.message || "");

  if (/invalid login credentials/i.test(message)) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }

  if (/already registered|user already registered/i.test(message)) {
    return "이미 가입된 이메일이에요.";
  }

  if (/password.*(at least|characters|6)/i.test(message)) {
    return "비밀번호는 6자 이상 입력해주세요.";
  }

  if (/email.*(invalid|valid)/i.test(message)) {
    return "올바른 이메일 주소를 입력해주세요.";
  }

  if (/email not confirmed/i.test(message)) {
    return "이메일 인증을 먼저 완료해주세요.";
  }

  if (/too many requests/i.test(message)) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
  }

  if (action === "signup") {
    return "회원가입에 실패했어요. 입력 정보를 확인하고 다시 시도해주세요.";
  }

  if (action === "login") {
    return "로그인에 실패했어요. 이메일과 비밀번호를 확인해주세요.";
  }

  return "로그아웃에 실패했어요. 다시 시도해주세요.";

}


// ========================================
// 4. 상품 분류 메뉴 및 상품 목록
// ========================================

function renderCategoryFilters(){

  const categories = [
    ...new Set(PRODUCTS.map(product => product.category).filter(Boolean))
  ];

  if (selectedCategory !== "전체" && !categories.includes(selectedCategory)) {
    selectedCategory = "전체";
  }

  const categoryIcons = {
    "인형 키링":"🧸",
    "아크릴 키링":"⭐"
  };

  const buttons = ["전체", ...categories].map(category => {

    const icon = categoryIcons[category] || "";

    const label = category === "전체"
      ? "전체"
      : `${icon ? icon + " " : ""}${escapeHTML(category)}`;

    return `
      <button
        class="filter-chip ${selectedCategory === category ? "selected" : ""}"
        data-category="${escapeHTML(category)}"
      >${label}</button>
    `;

  });

  $("#categoryFilters").innerHTML = buttons.join("");

}


function renderProducts(){

  const list = PRODUCTS.filter(product =>
    (selectedCategory === "전체" || product.category === selectedCategory) &&
    (
      String(product.name).toLowerCase().includes(searchTerm) ||
      String(product.category).toLowerCase().includes(searchTerm)
    )
  );

  $("#productGrid").innerHTML = list.map(product => `
    <article class="product-card">

      <div class="product-image-wrap" data-detail="${product.id}">

        <img
          class="product-image"
          src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
        >

        <button
          class="wish-button"
          data-wish="${product.id}"
          aria-label="찜하기"
        >♡</button>

      </div>

      <div class="product-info">

        <p class="product-name" data-detail="${product.id}">
          ${escapeHTML(product.name)}
        </p>

        <p class="product-price">
          ${money(product.price)}
        </p>

        <span class="point-badge">
          ★ ${currentTier().rate}% 적립
        </span>

      </div>

    </article>
  `).join("");

  $("#resultCount").textContent = `${list.length}개 상품`;

  $("#emptyState").textContent =
    "검색 결과가 없어요. 다른 키워드로 찾아보세요.";

  $("#emptyState").hidden = list.length !== 0;

}


function renderCartCount(){

  $("#cartCount").textContent =
    cart.reduce((sum, item) => sum + item.qty, 0);

}


// ========================================
// 5. 메인 슬라이드
// ========================================

function setSlide(index){

  slideIndex = (index + HEROES.length) % HEROES.length;

  const hero = HEROES[slideIndex];

  $("#heroImage").style.backgroundImage =
    `url("${hero.image}")`;

  $("#heroTitle").innerHTML = hero.title;

  $("#heroText").textContent = hero.text;

  $("#heroDots").innerHTML = HEROES.map((_, i) =>
    `<button class="${i === slideIndex ? "active" : ""}" data-slide="${i}" aria-label="${i + 1}번 배너"></button>`
  ).join("");

}


function startSlider(){

  clearInterval(slideTimer);

  slideTimer = setInterval(
    () => setSlide(slideIndex + 1),
    6000
  );

}


// ========================================
// 6. 팝업 및 회원가입 / 로그인 화면
// ========================================

function openModal(content){

  $("#modalContent").innerHTML = content;

  $("#modalBackdrop").hidden = false;

  document.body.style.overflow = "hidden";

}


function closeModal(){

  $("#modalBackdrop").hidden = true;

  document.body.style.overflow = "";

}


function signupForm(){

  openModal(`
    <h2 id="modalTitle">회원가입</h2>

    <p class="modal-sub">가입 즉시 3,000P를 드려요 ♡</p>

    <form id="signupForm">

      <label class="form-field">이름
        <input name="name" required maxlength="20" placeholder="이름을 입력해주세요" autocomplete="name">
      </label>

      <label class="form-field">이메일
        <input name="email" type="email" required placeholder="이메일을 입력해주세요" autocomplete="email">
      </label>

      <label class="form-field">연락처
        <input name="phone" type="tel" required placeholder="연락처를 입력해주세요" autocomplete="tel">
      </label>

      <label class="form-field">비밀번호
        <input name="password" type="password" required minlength="6" placeholder="6자 이상 입력해주세요" autocomplete="new-password">
      </label>

      <button class="form-submit">3,000P 받고 가입하기</button>

    </form>

    <p class="form-switch">
      이미 회원이신가요?
      <button class="text-button" id="switchLogin">로그인</button>
    </p>
  `);

}


function loginForm(){

  openModal(`
    <h2 id="modalTitle">로그인</h2>

    <p class="modal-sub">keyring에 다시 오신 걸 환영해요!</p>

    <form id="loginForm">

      <label class="form-field">이메일
        <input name="email" type="email" required placeholder="이메일을 입력해주세요" autocomplete="email">
      </label>

      <label class="form-field">비밀번호
        <input name="password" type="password" required placeholder="비밀번호를 입력해주세요" autocomplete="current-password">
      </label>

      <button class="form-submit">로그인</button>

    </form>

    <p class="form-switch">
      아직 회원이 아니신가요?
      <button class="text-button" id="switchSignup">회원가입</button>
    </p>
  `);

}


// ========================================
// 7. Supabase 회원가입 / 로그인 / 로그아웃
// ========================================

async function handleSignup(form){

  const formData = new FormData(form);

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");

  if (password.length < 6) {
    showToast("비밀번호는 6자 이상 입력해주세요.");
    return;
  }

  try {

    const { data, error } = await window.db.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone
        }
      }
    });

    if (error) {

      console.error(error.message);

      showToast(authErrorMessage(error, "signup"));

      return;

    }

    closeModal();

    if (data.session && data.user) {

      await loadMyProfile(data.user, true);

      showToast("회원가입이 완료됐어요! 환영합니다.");

    } else {

      showToast("가입 요청이 완료됐어요. 이메일 인증 후 로그인해주세요.");

    }

  } catch (error) {

    console.error(error?.message ?? error);

    showToast("회원가입 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");

  }

}


async function handleLogin(form){

  const formData = new FormData(form);

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {

    const { data, error } = await window.db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {

      console.error(error.message);

      showToast(authErrorMessage(error, "login"));

      return;

    }

    closeModal();

    await loadMyProfile(data.user, true);

    showToast("로그인했어요!");

  } catch (error) {

    console.error(error?.message ?? error);

    showToast("로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");

  }

}


async function handleLogout(){

  try {

    const { error } = await window.db.auth.signOut({
      scope: "local"
    });

    if (error) {

      console.error(error.message);

      showToast(authErrorMessage(error, "logout"));

      return;

    }

    currentAuthUser = null;
    currentUser = null;

    renderAuthMenu();
    renderProducts();

    closeModal();

    showToast("로그아웃했어요.");

  } catch (error) {

    console.error(error?.message ?? error);

    showToast("로그아웃 중 문제가 발생했어요. 다시 시도해주세요.");

  }

}


// ========================================
// 8. 상품 상세
// ========================================

function showDetail(id){

  const product = PRODUCTS.find(
    item => item.id === Number(id)
  );

  if (!product) return;

  openModal(`
    <h2 id="modalTitle">상품 상세</h2>

    <div class="detail-view">

      <img
        src="${escapeHTML(product.image_url)}"
        alt="${escapeHTML(product.name)}"
      >

      <div>

        <h3>${escapeHTML(product.name)}</h3>

        <p class="detail-price">
          ${money(product.price)}
        </p>

        <p class="detail-description">
          keyring에서 준비한 귀여운 키링입니다.
        </p>

        <p class="detail-description">
          남은 수량: ${product.stock}개
        </p>

        <div class="qty-control">

          <button id="detailMinus">−</button>

          <b id="detailQty">1</b>

          <button id="detailPlus">＋</button>

        </div>

        <button class="form-submit" id="detailAdd">
          장바구니 담기
        </button>

      </div>
    </div>
  `);

  let qty = 1;

  $("#detailMinus").onclick = () => {

    qty = Math.max(1, qty - 1);

    $("#detailQty").textContent = qty;

  };

  $("#detailPlus").onclick = () => {

    qty = Math.min(product.stock, qty + 1);

    $("#detailQty").textContent = qty;

  };

  $("#detailAdd").onclick = () => {

    addToCart(product.id, qty);

    closeModal();

  };

}


// ========================================
// 9. 장바구니
// ========================================

function addToCart(id, qty = 1){

  const product = PRODUCTS.find(
    item => item.id === Number(id)
  );

  if (!product) return;

  const found = cart.find(
    item => Number(item.id) === product.id
  );

  const nextQty = (found?.qty || 0) + qty;

  if (nextQty > product.stock) {

    showToast("재고 수량을 확인해주세요.");

    return;

  }

  if (found) {

    found.qty = nextQty;

  } else {

    cart.push({
      id: product.id,
      qty
    });

  }

  saveState();

  renderCartCount();

  showToast("장바구니에 담았어요!");

}


function showCart(){

  const lines = cart.map(item => {

    const product = PRODUCTS.find(
      p => p.id === Number(item.id)
    );

    return product ? { ...product, qty: item.qty } : null;

  }).filter(Boolean);


  const total = lines.reduce(
    (sum, product) => sum + product.price * product.qty,
    0
  );


  openModal(`
    <h2 id="modalTitle">장바구니</h2>

    <p class="modal-sub">
      마음에 드는 키링을 모아보세요.
    </p>

    ${
      lines.length
      ? lines.map(product => `
        <div class="cart-line">

          <img
            src="${escapeHTML(product.image_url)}"
            alt="${escapeHTML(product.name)}"
          >

          <div>

            <strong>${escapeHTML(product.name)}</strong>

            <small>${money(product.price)}</small>

            <div class="cart-qty">

              <button data-cart-minus="${product.id}">
                −
              </button>

              <span>${product.qty}</span>

              <button data-cart-plus="${product.id}">
                ＋
              </button>

            </div>

          </div>

          <button
            class="remove-button"
            data-remove="${product.id}"
          >삭제</button>

        </div>
      `).join("")
      : `<p class="empty-state">장바구니가 비어 있어요.</p>`
    }

    <div class="cart-total">
      <span>총 상품 금액</span>
      <span>${money(total)}</span>
    </div>

    <button
      class="form-submit"
      id="checkoutButton"
      ${lines.length ? "" : "disabled"}
    >
      체험 결제하기
    </button>

    <p class="form-switch">
      실제 결제는 진행되지 않으며 주문 내역만 저장됩니다.
    </p>
  `);

}


// ========================================
// 10. 체험 주문: Supabase에 저장
// ========================================

async function showCheckout(){

  // 결제 화면을 열기 전에 실제 Supabase 로그인 상태부터 확인합니다.
  const { data: sessionData, error: sessionError } =
    await window.db.auth.getSession();

  if (sessionError) {

    console.error(sessionError.message);

    showToast("로그인 상태를 확인하지 못했어요. 다시 시도해주세요.");

    return;

  }

  // 로그인하지 않았다면 로그인 화면으로 이동합니다.
  if (!sessionData.session?.user) {

    currentAuthUser = null;
    currentUser = null;

    renderAuthMenu();

    closeModal();

    loginForm();

    showToast("로그인 후 주문할 수 있어요.");

    return;

  }

  currentAuthUser = sessionData.session.user;

  // 회원 프로필이 준비되어 있는지 확인합니다.
  if (!currentUser || currentUser.id !== currentAuthUser.id) {

    const profile = await loadMyProfile(currentAuthUser, true);

    if (!profile) return;

  }

  if (!cart.length) return;


  // 장바구니 상품 합계 계산
  const total = cart.reduce((sum, item) => {

    const product = PRODUCTS.find(
      p => p.id === Number(item.id)
    );

    return sum + (product ? product.price * item.qty : 0);

  }, 0);


  // 적립 예정 포인트는 화면에만 표시합니다.
  const estimatedPoints = Math.floor(
    total * currentTier().rate / 100
  );


  openModal(`
    <h2 id="modalTitle">주문 확인</h2>

    <p class="modal-sub">
      체험 결제입니다. 실제 금액은 청구되지 않아요.
    </p>

    <div class="mypage-box">

      <div>
        주문 금액 <strong>${money(total)}</strong>
      </div>

      <div>
        적립 예정
        <b>${estimatedPoints.toLocaleString()}P</b>
      </div>

    </div>

    <label class="form-field">
      받는 분
      <input
        id="receiver"
        value="${escapeHTML(currentUser.name || "")}"
        required
      >
    </label>

    <label class="form-field">
      배송지
      <input
        id="address"
        placeholder="배송지를 입력해주세요"
        required
      >
    </label>

    <button class="form-submit" id="confirmOrder">
      주문 완료하기
    </button>
  `);

}


async function completeOrder(){

  // 최종 주문 저장 직전에도 로그인 상태를 다시 확인합니다.
  const { data: sessionData, error: sessionError } =
    await window.db.auth.getSession();

  if (sessionError) {

    console.error(sessionError.message);

    showToast("로그인 상태를 확인하지 못했어요. 다시 시도해주세요.");

    return;

  }

  if (!sessionData.session?.user) {

    currentAuthUser = null;
    currentUser = null;

    renderAuthMenu();

    closeModal();

    loginForm();

    showToast("로그인 후 주문할 수 있어요.");

    return;

  }

  currentAuthUser = sessionData.session.user;


  if (!currentUser || currentUser.id !== currentAuthUser.id) {

    const profile = await loadMyProfile(currentAuthUser, true);

    if (!profile) return;

  }


  const address = $("#address").value.trim();

  const receiver = $("#receiver").value.trim();


  if (!address || !receiver) {

    showToast("받는 분과 배송지를 입력해주세요.");

    return;

  }


  if (!cart.length) {

    showToast("장바구니가 비어 있어요.");

    return;

  }


  // --------------------------------------
  // 1. 같은 상품 ID의 수량 합치기
  // --------------------------------------

  const mergedItems = new Map();

  for (const item of cart) {

    const productId = Number(item.id);

    const qty = Number(item.qty);

    const product = PRODUCTS.find(
      p => p.id === productId
    );


    if (!product) {

      showToast("장바구니에 없는 상품이 있어요. 상품을 다시 담아주세요.");

      return;

    }


    if (!Number.isInteger(qty) || qty <= 0) {

      showToast("상품 수량을 확인해주세요.");

      return;

    }


    const existing = mergedItems.get(productId);

    if (existing) {

      existing.qty += qty;

    } else {

      mergedItems.set(productId, {
        product,
        qty
      });

    }

  }


  const orderLines = [...mergedItems.values()];


  // --------------------------------------
  // 2. 주문 합계 및 적립 예정 포인트 계산
  // --------------------------------------

  const total = orderLines.reduce(
    (sum, line) => sum + line.product.price * line.qty,
    0
  );

  const estimatedPoints = Math.floor(
    total * currentTier().rate / 100
  );


  const confirmButton = $("#confirmOrder");

  if (confirmButton) {

    confirmButton.disabled = true;

    confirmButton.textContent = "주문 저장 중...";

  }


  try {

    // --------------------------------------
    // 3. shop_orders에 주문 한 줄 저장
    // --------------------------------------

    // user_id와 status는 DB의 기본값이 처리합니다.
    // 따라서 total만 전송합니다.

    const { data: orderData, error: orderError } = await window.db

      .from("shop_orders")

      .insert({
        total
      })

      .select("id")

      .single();


    if (orderError) {

      console.error(orderError.message);

      showToast(
        "주문 정보를 저장하지 못했어요. 로그인 상태와 DB 권한을 확인해주세요."
      );

      if (confirmButton) {

        confirmButton.disabled = false;

        confirmButton.textContent = "주문 완료하기";

      }

      return;

    }


    // 방금 생성된 주문의 자동 번호를 가져옵니다.
    const orderId = orderData.id;


    // --------------------------------------
    // 4. shop_order_items에 상품 정보 저장
    // --------------------------------------

    const orderItems = orderLines.map(line => ({

      order_id: orderId,

      product_id: line.product.id,

      qty: line.qty,

      unit_price: line.product.price

    }));


    const { error: itemsError } = await window.db

      .from("shop_order_items")

      .insert(orderItems);


    if (itemsError) {

      console.error(itemsError.message);

      showToast(
        `주문 번호 ${orderId}는 생성됐지만 상품 내역 저장에 실패했어요. 장바구니는 유지됩니다.`
      );

      if (confirmButton) {

        confirmButton.disabled = false;

        confirmButton.textContent = "주문 완료하기";

      }

      return;

    }


    // --------------------------------------
    // 5. 주문 저장 성공 후 장바구니 비우기
    // --------------------------------------

    const order = {

      number: String(orderId),

      date: new Date().toLocaleString("ko-KR"),

      items: orderLines.map(line => ({
        id: line.product.id,
        qty: line.qty
      })),

      total,

      earned: estimatedPoints,

      status: "결제완료",

      receiver,

      address

    };


    orders.unshift(order);

    cart = [];


    // 포인트와 재고는 DB에 저장하거나 수정하지 않습니다.
    saveState();

    renderCartCount();

    renderProducts();


    // --------------------------------------
    // 6. 주문 완료 화면 표시
    // --------------------------------------

    openModal(`
      <h2 id="modalTitle">
        주문이 완료됐어요 ♡
      </h2>

      <p class="modal-sub">
        체험 주문이 Supabase에 저장되었습니다.
        실제 결제는 진행되지 않았어요.
      </p>

      <div class="mypage-box">

        주문 번호
        <strong>${escapeHTML(order.number)}</strong>
        <br>

        합계
        <strong>${money(total)}</strong>
        <br>

        적립 예정
        <strong>${estimatedPoints.toLocaleString()}P</strong>

      </div>

      <button class="form-submit" id="goMyPage">
        마이페이지에서 확인하기
      </button>
    `);


  } catch (error) {

    console.error(error?.message ?? error);

    showToast(
      "주문 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요."
    );

    if (confirmButton) {

      confirmButton.disabled = false;

      confirmButton.textContent = "주문 완료하기";

    }

  }

}


// ========================================
// 11. 마이페이지: shop_profiles에서 회원 정보 읽기
// ========================================

async function showMyPage(){

  if (!currentAuthUser) {

    loginForm();

    return;

  }


  const profile = await loadMyProfile(currentAuthUser, true);

  if (!profile) return;


  openModal(`
    <h2 id="modalTitle">마이페이지</h2>

    <p class="modal-sub">
      ${escapeHTML(profile.name || "회원")}님, 반가워요!
    </p>

    <div class="mypage-box">

      <div>
        이름:
        <b>${escapeHTML(profile.name || "-")}</b>
      </div>

      <div>
        이메일:
        ${escapeHTML(profile.email || "-")}
      </div>

      <div>
        회원 등급:
        <b>${escapeHTML(profile.grade || "-")}</b>
      </div>

      <strong>
        ${Number(profile.points || 0).toLocaleString()}P
      </strong>

      <div>보유 포인트</div>

    </div>

    <h3>주문 내역</h3>

    ${
      orders.length
      ? orders.map(order => `
        <div class="order-row">

          <b>${escapeHTML(order.number)}</b><br>

          ${escapeHTML(order.date)}
          · ${money(order.total)}<br>

          ${escapeHTML(order.status)}
          · 예상 적립
          ${Number(order.earned).toLocaleString()}P

        </div>
      `).join("")
      : `<p class="empty-state">아직 주문 내역이 없어요.</p>`
    }

    <button class="form-submit" id="logoutButton">
      로그아웃
    </button>
  `);

}


// ========================================
// 12. 버튼 및 화면 이벤트
// ========================================

document.addEventListener("click", event => {

  const authMenuAction = event.target.closest("#authMenuAction");

  if (authMenuAction) {

    event.preventDefault();

    if (currentAuthUser) {
      handleLogout();
    } else {
      loginForm();
    }

    return;

  }


  const detail = event.target.closest("[data-detail]");

  if (detail) {

    showDetail(detail.dataset.detail);

    return;

  }


  const wish = event.target.closest("[data-wish]");

  if (wish) {

    wish.classList.toggle("on");

    wish.textContent =
      wish.classList.contains("on") ? "♥" : "♡";

    return;

  }


  const filter = event.target.closest("[data-category]");

  if (filter) {

    selectedCategory = filter.dataset.category;

    document.querySelectorAll(".filter-chip").forEach(button =>
      button.classList.toggle("selected", button === filter)
    );

    renderProducts();

  }


  const dot = event.target.closest("[data-slide]");

  if (dot) {

    setSlide(Number(dot.dataset.slide));

    startSlider();

  }


  const minus = event.target.closest("[data-cart-minus]");

  if (minus) {

    const item = cart.find(
      x => Number(x.id) === Number(minus.dataset.cartMinus)
    );

    if (item) item.qty--;

    cart = cart.filter(x => x.qty > 0);

    saveState();

    renderCartCount();

    showCart();

  }


  const plus = event.target.closest("[data-cart-plus]");

  if (plus) {

    const item = cart.find(
      x => Number(x.id) === Number(plus.dataset.cartPlus)
    );

    if (item) {

      const product = PRODUCTS.find(
        x => x.id === Number(item.id)
      );

      if (product && item.qty < product.stock) {

        item.qty++;

      } else {

        showToast("재고 수량을 초과할 수 없어요.");

      }

    }

    saveState();

    renderCartCount();

    showCart();

  }


  const remove = event.target.closest("[data-remove]");

  if (remove) {

    cart = cart.filter(
      x => Number(x.id) !== Number(remove.dataset.remove)
    );

    saveState();

    renderCartCount();

    showCart();

  }

});


// ========================================
// 13. 검색 및 기존 버튼 이벤트
// ========================================

$("#searchForm").addEventListener("submit", event => {

  event.preventDefault();

  searchTerm = $("#searchInput").value.trim().toLowerCase();

  renderProducts();

  $("#products").scrollIntoView({ behavior: "smooth" });

});


$("#categoryFilters").addEventListener("click", () => {});


$("#signupAside").onclick =
  $("#signupBanner").onclick = signupForm;


$("#loginAside").onclick = loginForm;

$("#accountButton").onclick = showMyPage;

$("#cartButton").onclick = showCart;

$("#modalClose").onclick = closeModal;


$("#modalBackdrop").addEventListener("click", event => {

  if (event.target === $("#modalBackdrop")) {
    closeModal();
  }

});


$("#prevSlide").onclick = () => {

  setSlide(slideIndex - 1);

  startSlider();

};


$("#nextSlide").onclick = () => {

  setSlide(slideIndex + 1);

  startSlider();

};


document.querySelectorAll(".nav-link").forEach(link =>
  link.addEventListener("click", event => {

    if (link.dataset.view === "mypage") {

      event.preventDefault();

      showMyPage();

    } else if (link.dataset.view === "products") {

      event.preventDefault();

      $("#products").scrollIntoView({ behavior: "smooth" });

    }

  })
);


$("#modalContent").addEventListener("submit", event => {

  if (event.target.id === "signupForm") {

    event.preventDefault();

    handleSignup(event.target);

  }

  if (event.target.id === "loginForm") {

    event.preventDefault();

    handleLogin(event.target);

  }

});


$("#modalContent").addEventListener("click", event => {

  if (event.target.id === "switchLogin") {
    loginForm();
  }

  if (event.target.id === "switchSignup") {
    signupForm();
  }

  if (event.target.id === "checkoutButton") {
    showCheckout();
  }

  if (event.target.id === "confirmOrder") {
    completeOrder();
  }

  if (event.target.id === "goMyPage") {
    showMyPage();
  }

  if (event.target.id === "logoutButton") {
    handleLogout();
  }

});


// ========================================
// 14. 쇼핑몰 초기 실행
// ========================================

renderTiers();

renderCartCount();

setSlide(0);

startSlider();

ensureAuthMenu();

renderAuthMenu();

loadProductsFromDatabase();

initializeSupabaseAuth();