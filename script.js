/* 상품과 회원 등급 데이터: 추후 데이터베이스 테이블로 옮기기 쉽도록 상단에 분리 */
const PRODUCTS = [
  {id:1,name:"버니 인형 키링",category:"인형 키링",price:12000,stock:30,image:"img/product-1.jpg",description:"포근한 토끼 인형에 노란 리본을 더한 사랑스러운 키링."},
  {id:2,name:"곰돌이 인형 키링",category:"인형 키링",price:12000,stock:25,image:"img/product-2.jpg",description:"부드러운 브라운 곰돌이와 데일리로 함께해요."},
  {id:3,name:"클리어 리본 키링",category:"아크릴 키링",price:9000,stock:40,image:"img/product-3.jpg",description:"투명 리본과 작은 하트 참이 반짝이는 포인트 아이템."},
  {id:4,name:"하트 아크릴 키링",category:"아크릴 키링",price:8000,stock:35,image:"img/product-4.jpg",description:"상큼한 옐로우 하트로 가방에 사랑스러움을 더해요."},
  {id:5,name:"체리 키링",category:"아크릴 키링",price:8500,stock:28,image:"img/product-5.jpg",description:"귀여운 체리 모양으로 산뜻한 포인트를 완성해요."},
  {id:6,name:"데이지 키링",category:"아크릴 키링",price:8500,stock:32,image:"img/product-6.jpg",description:"하얀 데이지 꽃이 달린 깨끗하고 발랄한 키링."},
  {id:7,name:"체크 리본 키링",category:"아크릴 키링",price:9000,stock:24,image:"img/product-7.jpg",description:"옐로우 체크 리본으로 러블리한 무드를 연출해요."},
  {id:8,name:"투명 곰돌이 키링",category:"아크릴 키링",price:10000,stock:20,image:"img/product-8.jpg",description:"투명한 곰돌이 쉐입이 은은하게 빛나는 키링."}
];
const MEMBER_TIERS = [
  {name:"스위트",min:0,rate:1},{name:"베이직",min:30000,rate:3},
  {name:"플래티넘",min:100000,rate:5},{name:"VIP",min:300000,rate:7}
];
const HEROES = [
  {image:"img/hero-1.jpg",title:"반짝이는 일상 속,<br>작은 행복 ♡",text:"지금, 키링과 함께해요!"},
  {image:"img/hero-2.jpg",title:"오늘의 가방에<br>작은 포인트를",text:"취향을 담은 리본 키링"},
  {image:"img/hero-3.jpg",title:"your little<br>happy moment ♡",text:"매일 함께하고 싶은 귀여움"},
  {image:"img/hero-4.jpg",title:"귀여움을 달고<br>오늘도 반짝!",text:"keyring에서 만나보세요"}
];

const $ = (selector) => document.querySelector(selector);
const money = (value) => `${Number(value).toLocaleString("ko-KR")}원`;
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let currentUser = load("keyringUser", null);
let cart = load("keyringCart", []);
let orders = load("keyringOrders", []);
let selectedCategory = "전체";
let searchTerm = "";
let slideIndex = 0;
let slideTimer;
let toastTimer;

function saveState(){
  localStorage.setItem("keyringUser",JSON.stringify(currentUser));
  localStorage.setItem("keyringCart",JSON.stringify(cart));
  localStorage.setItem("keyringOrders",JSON.stringify(orders));
  if(currentUser) localStorage.setItem("keyringAccount_"+currentUser.id,JSON.stringify(currentUser));
}
function showToast(message){
  const toast=$("#toast"); toast.textContent=message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);
}
function currentTier(user=currentUser){
  if(!user) return MEMBER_TIERS[0];
  return [...MEMBER_TIERS].reverse().find(t=>user.totalSpent>=t.min)||MEMBER_TIERS[0];
}
function renderTiers(){
  $("#tierList").innerHTML=MEMBER_TIERS.map(t=>`<div class="tier-row"><b>${t.name}</b><span>${t.rate}% 적립</span></div>`).join("");
}
function renderProducts(){
  const list=PRODUCTS.filter(p=>(selectedCategory==="전체"||p.category===selectedCategory)&&
    (p.name.toLowerCase().includes(searchTerm)||p.category.toLowerCase().includes(searchTerm)));
  $("#productGrid").innerHTML=list.map(p=>`
    <article class="product-card">
      <div class="product-image-wrap" data-detail="${p.id}">
        <img class="product-image" src="${p.image}" alt="${p.name}" loading="lazy">
        <button class="wish-button" data-wish="${p.id}" aria-label="찜하기">♡</button>
      </div>
      <div class="product-info">
        <p class="product-name" data-detail="${p.id}">${p.name}</p>
        <p class="product-price">${money(p.price)}</p>
        <span class="point-badge">★ ${currentTier().rate}% 적립</span>
      </div>
    </article>`).join("");
  $("#resultCount").textContent=`${list.length}개 상품`;
  $("#emptyState").hidden=list.length!==0;
}
function renderCartCount(){ $("#cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0); }
function setSlide(index){
  slideIndex=(index+HEROES.length)%HEROES.length;
  const hero=HEROES[slideIndex];
  $("#heroImage").style.backgroundImage=`url("${hero.image}")`;
  $("#heroTitle").innerHTML=hero.title; $("#heroText").textContent=hero.text;
  $("#heroDots").innerHTML=HEROES.map((_,i)=>`<button class="${i===slideIndex?"active":""}" data-slide="${i}" aria-label="${i+1}번 배너"></button>`).join("");
}
function startSlider(){clearInterval(slideTimer);slideTimer=setInterval(()=>setSlide(slideIndex+1),6000);}
function openModal(content){$("#modalContent").innerHTML=content;$("#modalBackdrop").hidden=false;document.body.style.overflow="hidden";}
function closeModal(){$("#modalBackdrop").hidden=true;document.body.style.overflow="";}
function signupForm(){openModal(`<h2 id="modalTitle">회원가입</h2><p class="modal-sub">가입 즉시 3,000P를 드려요 ♡</p>
  <form id="signupForm">
  <label class="form-field">이름<input name="name" required maxlength="20" placeholder="이름을 입력해주세요"></label>
  <label class="form-field">아이디<input name="id" required minlength="4" maxlength="20" placeholder="4자 이상 입력해주세요"></label>
  <label class="form-field">비밀번호<input name="password" type="password" required minlength="4" placeholder="4자 이상 입력해주세요"></label>
  <button class="form-submit">3,000P 받고 가입하기</button></form>
  <p class="form-switch">이미 회원이신가요? <button class="text-button" id="switchLogin">로그인</button></p>`);}
function loginForm(){openModal(`<h2 id="modalTitle">로그인</h2><p class="modal-sub">keyring에 다시 오신 걸 환영해요!</p>
  <form id="loginForm"><label class="form-field">아이디<input name="id" required></label>
  <label class="form-field">비밀번호<input name="password" type="password" required></label>
  <button class="form-submit">로그인</button></form>
  <p class="form-switch">아직 회원이 아니신가요? <button class="text-button" id="switchSignup">회원가입</button></p>`);}
function showDetail(id){
  const p=PRODUCTS.find(x=>x.id===Number(id)); if(!p)return;
  openModal(`<h2 id="modalTitle">상품 상세</h2><div class="detail-view"><img src="${p.image}" alt="${p.name}">
    <div><h3>${p.name}</h3><p class="detail-price">${money(p.price)}</p><p class="detail-description">${p.description}</p>
    <p class="detail-description">남은 수량: ${p.stock}개</p><div class="qty-control"><button id="detailMinus">−</button><b id="detailQty">1</b><button id="detailPlus">＋</button></div>
    <button class="form-submit" id="detailAdd">장바구니 담기</button></div></div>`);
  let qty=1;
  $("#detailMinus").onclick=()=>{qty=Math.max(1,qty-1);$("#detailQty").textContent=qty;};
  $("#detailPlus").onclick=()=>{qty=Math.min(p.stock,qty+1);$("#detailQty").textContent=qty;};
  $("#detailAdd").onclick=()=>{addToCart(p.id,qty);closeModal();};
}
function addToCart(id,qty=1){
  const p=PRODUCTS.find(x=>x.id===Number(id));if(!p)return;
  const found=cart.find(x=>x.id===p.id),next=(found?.qty||0)+qty;
  if(next>p.stock){showToast("재고 수량을 확인해주세요.");return;}
  if(found)found.qty=next;else cart.push({id:p.id,qty});
  saveState();renderCartCount();showToast("장바구니에 담았어요!");
}
function showCart(){
  const lines=cart.map(item=>{const p=PRODUCTS.find(x=>x.id===item.id);return p?{...p,qty:item.qty}:null;}).filter(Boolean);
  const total=lines.reduce((s,p)=>s+p.price*p.qty,0);
  openModal(`<h2 id="modalTitle">장바구니</h2><p class="modal-sub">마음에 드는 키링을 모아보세요.</p>
    ${lines.length?lines.map(p=>`<div class="cart-line"><img src="${p.image}" alt=""><div><strong>${p.name}</strong><small>${money(p.price)}</small>
      <div class="cart-qty"><button data-cart-minus="${p.id}">−</button><span>${p.qty}</span><button data-cart-plus="${p.id}">＋</button></div></div>
      <button class="remove-button" data-remove="${p.id}">삭제</button></div>`).join(""):`<p class="empty-state">장바구니가 비어 있어요.</p>`}
    <div class="cart-total"><span>총 상품 금액</span><span>${money(total)}</span></div>
    <button class="form-submit" id="checkoutButton" ${lines.length?"":"disabled"}>체험 결제하기</button>
    <p class="form-switch">실제 결제는 진행되지 않으며 주문 내역만 저장됩니다.</p>`);
}
function showCheckout(){
  if(!currentUser){closeModal();loginForm();showToast("로그인 후 주문할 수 있어요.");return;}
  if(!cart.length)return;
  const total=cart.reduce((s,i)=>{const p=PRODUCTS.find(x=>x.id===i.id);return s+(p?p.price*i.qty:0);},0);
  openModal(`<h2 id="modalTitle">주문 확인</h2><p class="modal-sub">체험 결제입니다. 실제 금액은 청구되지 않아요.</p>
    <div class="mypage-box"><div>주문 금액 <strong>${money(total)}</strong></div><div>예상 적립 포인트 <b>${Math.floor(total*currentTier().rate/100).toLocaleString()}P</b></div></div>
    <label class="form-field">받는 분<input id="receiver" value="${currentUser.name}" required></label>
    <label class="form-field">배송지<input id="address" placeholder="배송지를 입력해주세요" required></label>
    <button class="form-submit" id="confirmOrder">주문 완료하기</button>`);
}
function completeOrder(){
  const address=$("#address").value.trim(),receiver=$("#receiver").value.trim();
  if(!address||!receiver){showToast("받는 분과 배송지를 입력해주세요.");return;}
  const total=cart.reduce((s,i)=>{const p=PRODUCTS.find(x=>x.id===i.id);return s+(p?p.price*i.qty:0);},0);
  const earned=Math.floor(total*currentTier().rate/100);
  const order={number:"KR"+Date.now().toString().slice(-8),date:new Date().toLocaleString("ko-KR"),items:cart.map(x=>({...x})),total,earned,status:"체험 주문 완료",receiver,address};
  orders.unshift(order);currentUser.points+=earned;currentUser.totalSpent+=total;cart=[];
  saveState();renderCartCount();renderProducts();
  openModal(`<h2 id="modalTitle">주문이 완료됐어요 ♡</h2><p class="modal-sub">체험 주문 내역이 저장되었습니다.</p>
    <div class="mypage-box">주문번호 <strong>${order.number}</strong><br>적립 포인트 <strong>+${earned.toLocaleString()}P</strong></div>
    <button class="form-submit" id="goMyPage">마이페이지에서 확인하기</button>`);
}
function showMyPage(){
  if(!currentUser){loginForm();return;}
  const tier=currentTier();
  openModal(`<h2 id="modalTitle">마이페이지</h2><p class="modal-sub">${currentUser.name}님, 반가워요!</p>
    <div class="mypage-box"><div><b>${tier.name}</b> 등급 · ${tier.rate}% 적립</div><strong>${currentUser.points.toLocaleString()}P</strong><div>보유 포인트</div></div>
    <p class="modal-sub">누적 구매 금액 ${money(currentUser.totalSpent)}</p><h3>주문 내역</h3>
    ${orders.length?orders.map(o=>`<div class="order-row"><b>${o.number}</b><br>${o.date} · ${money(o.total)}<br>${o.status} · +${o.earned.toLocaleString()}P</div>`).join(""):`<p class="empty-state">아직 주문 내역이 없어요.</p>`}
    <button class="form-submit" id="logoutButton">로그아웃</button>`);
}
function handleSignup(form){
  const data=new FormData(form),id=String(data.get("id")).trim();
  if(load("keyringRegisteredIds",[]).includes(id)){showToast("이미 사용 중인 아이디예요.");return;}
  currentUser={name:String(data.get("name")).trim(),id,password:String(data.get("password")),points:3000,totalSpent:0};
  const ids=load("keyringRegisteredIds",[]);ids.push(id);localStorage.setItem("keyringRegisteredIds",JSON.stringify(ids));
  saveState();closeModal();renderProducts();showToast("가입 완료! 3,000P를 지급했어요.");
}
function handleLogin(form){
  const data=new FormData(form),id=String(data.get("id")).trim(),password=String(data.get("password"));
  // 수업용 데모이므로 현재 브라우저에 저장된 회원만 로그인할 수 있습니다.
  const registered=load("keyringAccount_"+id,null);
  const account=registered||((currentUser&&currentUser.id===id)?currentUser:null);
  if(!account||account.password!==password){showToast("아이디 또는 비밀번호를 확인해주세요.");return;}
  currentUser=account;saveState();closeModal();renderProducts();showToast("로그인했어요!");
}
document.addEventListener("click",e=>{
  const detail=e.target.closest("[data-detail]");if(detail){showDetail(detail.dataset.detail);return;}
  const wish=e.target.closest("[data-wish]");if(wish){wish.classList.toggle("on");wish.textContent=wish.classList.contains("on")?"♥":"♡";return;}
  const filter=e.target.closest("[data-category]");if(filter){selectedCategory=filter.dataset.category;document.querySelectorAll(".filter-chip").forEach(b=>b.classList.toggle("selected",b===filter));renderProducts();}
  const dot=e.target.closest("[data-slide]");if(dot){setSlide(Number(dot.dataset.slide));startSlider();}
  const minus=e.target.closest("[data-cart-minus]");if(minus){const item=cart.find(x=>x.id===Number(minus.dataset.cartMinus));if(item)item.qty--;cart=cart.filter(x=>x.qty>0);saveState();renderCartCount();showCart();}
  const plus=e.target.closest("[data-cart-plus]");if(plus){const item=cart.find(x=>x.id===Number(plus.dataset.cartPlus));if(item){const p=PRODUCTS.find(x=>x.id===item.id);if(item.qty<p.stock)item.qty++;else showToast("재고 수량을 초과할 수 없어요.");}saveState();renderCartCount();showCart();}
  const remove=e.target.closest("[data-remove]");if(remove){cart=cart.filter(x=>x.id!==Number(remove.dataset.remove));saveState();renderCartCount();showCart();}
});
$("#searchForm").addEventListener("submit",e=>{e.preventDefault();searchTerm=$("#searchInput").value.trim().toLowerCase();renderProducts();$("#products").scrollIntoView({behavior:"smooth"});});
$("#categoryFilters").addEventListener("click",()=>{});
$("#signupAside").onclick=$("#signupBanner").onclick=signupForm;
$("#loginAside").onclick=loginForm;
$("#accountButton").onclick=showMyPage;
$("#cartButton").onclick=showCart;
$("#modalClose").onclick=closeModal;
$("#modalBackdrop").addEventListener("click",e=>{if(e.target===$("#modalBackdrop"))closeModal();});
$("#prevSlide").onclick=()=>{setSlide(slideIndex-1);startSlider();};
$("#nextSlide").onclick=()=>{setSlide(slideIndex+1);startSlider();};
document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",e=>{
  if(a.dataset.view==="mypage"){e.preventDefault();showMyPage();}
  else if(a.dataset.view==="products"){e.preventDefault();$("#products").scrollIntoView({behavior:"smooth"});}
}));
$("#modalContent").addEventListener("submit",e=>{
  if(e.target.id==="signupForm"){e.preventDefault();handleSignup(e.target);}
  if(e.target.id==="loginForm"){e.preventDefault();handleLogin(e.target);}
});
$("#modalContent").addEventListener("click",e=>{
  if(e.target.id==="switchLogin")loginForm();
  if(e.target.id==="switchSignup")signupForm();
  if(e.target.id==="checkoutButton")showCheckout();
  if(e.target.id==="confirmOrder")completeOrder();
  if(e.target.id==="goMyPage")showMyPage();
  if(e.target.id==="logoutButton"){currentUser=null;saveState();closeModal();renderProducts();showToast("로그아웃했어요.");}
});
renderTiers();renderProducts();renderCartCount();setSlide(0);startSlider();
