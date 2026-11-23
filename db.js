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

// 다른 JavaScript 파일에서도 사용할 수 있도록 설정
window.db = db;


// 3. Supabase 연결 확인
async function checkSupabaseConnection() {

  try {

    const { count, error } = await db
      .from("shop_products")
      .select("id", {
        count: "exact",
        head: true
      });

    // 연결 실패 시 오류 메시지 출력
    if (error) {
      console.error(error.message);
      return;
    }

    // 연결 성공 시 상품 개수 출력
    console.log(`연결 성공: 상품 ${count ?? 0}개`);

  } catch (error) {

    console.error(error?.message ?? error);

  }
}


// 4. 페이지가 열리면 연결 확인
checkSupabaseConnection();