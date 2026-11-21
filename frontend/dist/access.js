(function () {
  const SUPABASE_URL = "https://xddphuxfcucmjokcpkex.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_Zi16ftqqnKWSyC0RJ9kKzQ_uZln61Ou";
  const ACCESS_KEY = "thesis-site-access";

  const form = document.getElementById("access-form");
  const codeInput = document.getElementById("access-code");
  const message = document.getElementById("access-message");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "Checking...";

    try {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await client.rpc("verify_site_access", {
        submitted_code: codeInput.value
      });

      if (error?.code === "PGRST202") {
        message.textContent = "Site access is not configured yet.";
        return;
      }

      if (error || data !== true) {
        message.textContent = "Invalid access code.";
        codeInput.select();
        return;
      }

      sessionStorage.setItem(ACCESS_KEY, "granted");
      const returnUrl = new URLSearchParams(window.location.search).get("return");

      if (returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
        window.location.assign(returnUrl);
      } else {
        window.location.assign("index.html");
      }
    } catch (_) {
      message.textContent = "Access is temporarily unavailable.";
    }
  });
})();
