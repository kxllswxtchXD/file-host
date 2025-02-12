import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import type { GetServerSideProps } from "next";
import type { IncomingMessage } from "http";

const textContent = `
THE NULL POINTER
================

Temporary file hoster.

min_age = 30 days
max_age = 30 days
max_size = 512.0 MiB

==========================================================================================

• Uploading files

Send HTTP POST requests to https://i0x5f3759df.lol with data encoded as multipart/form-data

Valid fields are:
  ┌─────────┬────────────┬────────────────────────────────────────────────┐
  │ field   │ content    │ remarks                                        │
  ╞═════════╪════════════╪════════════════════════════════════════════════╡
  │ file    │ data       │ Required. The file to be uploaded.             │
  ├─────────┼────────────┼────────────────────────────────────────────────┤
  │ secret  │ boolean    │ If "true", generates a longer, hard-to-guess   │
  │         │ ("true")   │ URL for the file. Optional.                    │
  ├─────────┼────────────┼────────────────────────────────────────────────┤
  │ expires │ hours OR   │ Sets maximum file lifetime in hours OR         │
  │         │ ms since   │ the time of expiration in milliseconds since   │
  │         │ epoch      │ UNIX epoch. Defaults to 30 days if not set.    │
  └─────────┴────────────┴────────────────────────────────────────────────┘

• Managing your files

Whenever a file that does not already exist or has expired is uploaded,
the HTTP response header includes an X-Token field. You can use this
to perform management operations on the file.

To delete a file, send an HTTP POST request with
application/x-www-form-urlencoded encoding to https://i0x5f3759df.lol, 
including the delete token in the request body.

Valid fields are:
  ┌─────────┬────────────┬────────────────────────────────────────────────┐
  │ field   │ content    │ remarks                                        │
  ╞═════════╪════════════╪════════════════════════════════════════════════╡
  │ delete  │ token      │ Management token returned in X-Token HTTP      │
  │         │            │ header after upload. Required.                 │
  └─────────┴────────────┴────────────────────────────────────────────────┘

When using cURL, you can add the -i option to view the response header.

==========================================================================================

• Abuse and File Removal

To report abuse or request file removal, use one of the following
contact method:

    * email: i0x5f3759df@dnmx.su (do not copy and paste)
`;

const parseTextContent = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  return text.split(urlRegex).map((part, index) => {
    if (part.match(/^https?:\/\//)) {
      return (
        <Link key={index} href={part} className="text-blue-400 underline inline">
          {part}
        </Link>
      );
    } else if (part.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      return (
        <Link key={index} href={`mailto:${part}`} className="text-blue-400 underline inline">
          {part}
        </Link>
      );
    }
    return part;
  });
};

const Home: React.FC = () => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => setIsHydrated(true), []);

  useEffect(() => {
    const handleFormSubmit = async (event: Event) => {
      event.preventDefault();

      if (event.target instanceof HTMLFormElement) {
        const formData = new FormData(event.target);

        try {
          const response = await fetch("/", {
            method: "POST",
            body: formData,
          });
          console.log("Upload Response:", await response.json());
        } catch (error) {
          console.error("Error submitting form:", error);
        }
      }
    };

    const forms = document.querySelectorAll("form");
    forms.forEach((form) => form.addEventListener("submit", handleFormSubmit));

    return () => {
      forms.forEach((form) => form.removeEventListener("submit", handleFormSubmit));
    };
  }, []);

  if (!isHydrated) return null;

  return (
    <div>
      <Logo />
      <pre className="ml-6 mb-6 text-sm leading-4 tracking-tighter text-gray-200">
        {parseTextContent(textContent)}
      </pre>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  if (req.method === "POST") {
    try {
      const requestBody = await streamToBuffer(req);
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers.host;
      const apiBaseUrl = `${protocol}://${host}`;
      
      const response = await fetch(`${apiBaseUrl}/api/upload`, {
        method: "POST",
        body: requestBody,
        headers: { ...req.headers as Record<string, string> },
        ...(process.version.startsWith("v18") ? { duplex: "half" } : {}),
      });

      const responseData = await response.arrayBuffer();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(responseData));
      
      return { props: {} };
    } catch (error) {
      console.error("Error processing request:", error);
      return { props: { error: "Error processing request." } };
    }
  }

  return { props: {} };
};

const streamToBuffer = async (stream: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export default Home;