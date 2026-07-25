export default function TabBar(props: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    );
    const currentTab =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[role="tab"]')
        : null;
    const currentIndex = currentTab ? tabs.indexOf(currentTab) : -1;
    if (currentIndex === -1 || tabs.length === 0) return;

    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    }

    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return (
    <div
      aria-label={props.ariaLabel}
      aria-orientation="horizontal"
      className="sticky top-0 z-10 flex min-h-11 border-b border-gray-300 bg-white px-4 dark:border-gray-700 dark:bg-gray-800"
      onKeyDown={onKeyDown}
      role="tablist"
    >
      {props.children}
    </div>
  );
}
