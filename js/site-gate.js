(function () {
  const SUPABASE_URL = "https://xddphuxfcucmjokcpkex.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_Zi16ftqqnKWSyC0RJ9kKzQ_uZln61Ou";
  const ACCESS_KEY = "thesis-site-access";

  async function checkSession() {
    if (sessionStorage.getItem(ACCESS_KEY) === "granted") {
      document.body.classList.remove("site-gated");
      return;
    }
    redirectToLogin();
  }

  function redirectToLogin() {
    const returnUrl = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace(`access.html?return=${encodeURIComponent(returnUrl)}`);
  }

  checkSession();
})();
