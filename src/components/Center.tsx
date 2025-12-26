export default function Center(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-center items-center text-gray-700 dark:text-gray-300 ${props.className}`}
    >
      {props.children}
    </div>
  );
}
