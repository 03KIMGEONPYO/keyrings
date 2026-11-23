// ========================================
// keyring 쇼핑몰 Supabase 연결
// ========================================

// 1. Supabase 프로젝트 정보
const SUPABASE_URL =
  "https://kdacgudbdxgzmzxvxcvm.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_owZ6uZl4jVgnYjGwlYG53A_7J3vKfUQ";


// 2. Supabase 연결 객체 생성
const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

window.db = db;


// 3. 상품 개수 확인
async function checkSupabaseConnection() {

  const { count, error } = await db
    .from("shop_products")
    .select("id", {
      count: "exact",
      head: true
    });

  if (error) {
    console.error(error.message);
    return;
  }

  console.log(`연결 성공: 상품 ${count ?? 0}개`);

}


// 4. 페이지가 열리면 연결 확인
checkSupabaseConnection();