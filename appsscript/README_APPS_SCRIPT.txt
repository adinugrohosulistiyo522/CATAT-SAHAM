CATATSAHAM — APPS SCRIPT SETUP

1. Salin Code.gs ke project Google Apps Script.
2. Jalankan setupCatatSaham() sekali.
3. Buka Execution log dan salin URL database serta apiKey dari CATATSAHAM_SETUP_RESULT.
4. Deploy sebagai Web App: Execute as Me, Who has access Anyone.
5. Masukkan APPS_SCRIPT_URL dan CATATSAHAM_API_KEY pada Cloudflare Worker Settings > Variables and Secrets > Production.

API key tidak boleh diletakkan pada frontend atau di repository. Cloudflare Worker akan menyisipkannya saat menghubungi Apps Script.
