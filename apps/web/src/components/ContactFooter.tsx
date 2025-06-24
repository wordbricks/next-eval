export function ContactFooter() {
  return (
    <footer className="mt-16 p-6">
      <div className="space-y-3 text-center">
        <p className="text-gray-700 text-sm">
          Have questions or ideas? We'd love to hear from you. Contact us at{" "}
          <a
            href="mailto:research@wordbricks.ai"
            className="text-blue-600 transition-colors duration-150 hover:text-blue-700 hover:underline focus:underline focus:outline-hidden"
          >
            research@wordbricks.ai
          </a>
        </p>

        <p className="text-gray-700 text-sm">
          To see what else we're building, explore our latest technologies at{" "}
          <a
            href="https://nextrows.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 transition-colors duration-150 hover:text-blue-700 hover:underline focus:underline focus:outline-hidden"
          >
            nextrows.com
          </a>
        </p>
      </div>
    </footer>
  );
}
