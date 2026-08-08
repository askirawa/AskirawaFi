document.addEventListener("DOMContentLoaded", () => {
  const connectWalletBtn = document.querySelector("#connectWallet");
  const launchTreasuryBtn = document.querySelector("#launchTreasury");
  const watchDemoBtn = document.querySelector("#watchDemo");

  // Wallet connection
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", async () => {
      if (typeof window.ethereum === "undefined") {
        alert(
          "No compatible wallet detected. Please open AskirawaFi in a Web3-enabled wallet."
        );
        return;
      }

      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts"
        });

        if (accounts.length > 0) {
          const address = accounts[0];
          connectWalletBtn.textContent =
            address.slice(0, 6) + "..." + address.slice(-4);

          connectWalletBtn.classList.add("connected");

          alert("Wallet connected successfully.");
        }
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    });
  }

  // Launch Treasury
  if (launchTreasuryBtn) {
    launchTreasuryBtn.addEventListener("click", () => {
      const treasurySection = document.querySelector("#treasury");

      if (treasurySection) {
        treasurySection.scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  }

  // Watch Demo
  if (watchDemoBtn) {
    watchDemoBtn.addEventListener("click", () => {
      alert(
        "AskirawaFi demo: programmable USDC treasury management powered by Arc and Circle."
      );
    });
  }

  // Smooth navigation
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");

      if (targetId && targetId !== "#") {
        const target = document.querySelector(targetId);

        if (target) {
          event.preventDefault();

          target.scrollIntoView({
            behavior: "smooth"
          });
        }
      }
    });
  });
});
