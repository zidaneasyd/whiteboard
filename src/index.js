export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Rute API akan diisi di langkah-langkah berikutnya (auth, CRUD, upload)
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    // Fallback: sajikan static assets dari folder public/
    return env.ASSETS.fetch(request);
  },
};
