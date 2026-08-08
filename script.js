document.addEventListener("DOMContentLoaded", () => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const connectButton = buttons.find(
    (button) => button.textContent.trim().toLowerCase() === "connect wallet"
  );

  if (!connectButton) return;

  connectButton.addEventListener("click", async () => {
    if (!window.ethereum) {
      alert("Please open AskirawaFi in MetaMask or install MetaMask.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const address = accounts[0];

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x13b2" }]
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x13b2",
              chainName: "Arc",
              nativeCurrency: {
                name: "USDC",
                symbol: "USDC",
                decimals: 6
              },
              rpcUrls: ["https://rpc.arc.network"],
              blockExplorerUrls: ["https://explorer.arc.io"]
            }]
          });
        } else {
          throw switchError;
        }
      }

      connectButton.textContent =
        address.slice(0, 6) + "..." + address.slice(-4);

      connectButton.dataset.connected = "true";

      console.log("AskirawaFi wallet connected:", address);

    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert("Wallet connection was cancelled or failed.");
    }
  });
});
