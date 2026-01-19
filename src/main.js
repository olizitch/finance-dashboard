async function load() {
  const res = await fetch("/dashboard.json", { cache: "no-store" });
  const data = await res.json();

  document.querySelector("#app").innerHTML = `
    <h1>Finance dashboard</h1>
    <p>Updated: ${new Date(data.updatedAt).toLocaleString()}</p>

    <h2>FX</h2>
    <pre>${JSON.stringify(data.fx, null, 2)}</pre>

    <h2>Crypto</h2>
    <pre>${JSON.stringify(data.crypto, null, 2)}</pre>

    <h2>Stocks</h2>
    <pre>${JSON.stringify(data.stocks, null, 2)}</pre>
  `;
}

load();
