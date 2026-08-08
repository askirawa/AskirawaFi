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
// =========================================
// TREASURY CONTROL CENTER INTERACTIONS
// =========================================

const sendPaymentBtn = document.querySelector("#sendPayment");
const schedulePaymentBtn = document.querySelector("#schedulePayment");
const viewActivityBtn = document.querySelector("#viewActivity");

// Send USDC
if (sendPaymentBtn) {
  sendPaymentBtn.addEventListener("click", () => {
    const amount = prompt("Enter the USDC amount you want to send:");

    if (amount === null) return;

    const value = Number(amount);

    if (!value || value <= 0) {
      alert("Please enter a valid USDC amount.");
      return;
    }

    alert(
      `Payment request created for ${value.toLocaleString()} USDC.\n\nWallet confirmation will be required before the transaction is executed.`
    );
  });
}

// Schedule payment
if (schedulePaymentBtn) {
  schedulePaymentBtn.addEventListener("click", () => {
    const amount = prompt("Enter the USDC amount to schedule:");

    if (amount === null) return;

    const value = Number(amount);

    if (!value || value <= 0) {
      alert("Please enter a valid USDC amount.");
      return;
    }

    alert(
      `Scheduled payment created for ${value.toLocaleString()} USDC.\n\nAutomation rules will determine when the payment is executed.`
    );
  });
}

// View activity
if (viewActivityBtn) {
  viewActivityBtn.addEventListener("click", () => {
    const activitySection = document.querySelector("#activity");

    if (activitySection) {
      activitySection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
}
