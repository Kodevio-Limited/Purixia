'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="w-full bg-[#FFFBEB] pt-[60px] pb-[30px] px-4 sm:px-6 md:px-[40px] lg:px-[80px] border-t border-gray-100">
      <div className="max-w-[1440px] mx-auto w-full grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-[40px]">
        {/* Company Info */}
        <div className="col-span-1 space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/Logo2.jpg" alt="Purixia BD" width={110} height={64} className="object-contain" />
          </Link>
          <p className="text-[13px] text-[#666666] leading-relaxed font-poppins">
          Purixia BD | The Pure Paragon.
          Built on integrity, driven by trust. Your one-stop destination for authentic tech, from smart gadgets to everyday essentials — small beginnings, big promises.
          </p>
        </div>

        {/* About Links */}
        <div className="col-span-1">
          <h3 className="text-[16px] font-bold text-black mb-4 font-poppins uppercase tracking-wider">About</h3>
          <ul className="space-y-3">
            <li><Link href="/" className="text-[#666666] hover:text-[#F4B227] text-[13px] font-poppins">Home</Link></li>
            <li><Link href="/products" className="text-[#666666] hover:text-[#F4B227] text-[13px] font-poppins">Categories</Link></li>
            <li><Link href="/faq" className="text-[#666666] hover:text-[#F4B227] text-[13px] font-poppins">FAQ</Link></li>
          </ul>
        </div>

        {/* Contact Links */}
        <div className="col-span-1">
          <h3 className="text-[16px] font-bold text-black mb-4 font-poppins uppercase tracking-wider">Contact</h3>
          <ul className="space-y-3">
            <li className="text-[#666666] text-[13px] font-poppins">Email: purixiabd@gmail.com</li>
            <li className="text-[#666666] text-[13px] font-poppins">
              Phone: +880 1334-177276
            </li>
            <li className="text-[#666666] text-[13px] font-poppins">Address: Dhaka, Bangladesh</li>
          </ul>
        </div>

        {/* Support Links */}
        <div className="col-span-1">
          <h3 className="text-[16px] font-bold text-black mb-4 font-poppins uppercase tracking-wider">Support</h3>
          <ul className="space-y-3">
            <li><Link href="/privacy-policy" className="text-[#666666] hover:text-[#F4B227] text-[13px] font-poppins">Privacy Policy</Link></li>
            <li><Link href="/terms-and-conditions" className="text-[#666666] hover:text-[#F4B227] text-[13px] font-poppins">Terms & Condition</Link></li>
            <li><Link href="/contact-us" className="text-[#666666] hover:text-[#F4B227] text-[13px] font-poppins">Contact Us</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto w-full mt-[60px] pt-[20px] border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-[12px] text-[#666666] font-poppins">
          © 2026 Purixia BD. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <a
            href="https://www.facebook.com/share/1KD29FBDs6/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="text-black hover:text-[#F4B227] transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="w-5 h-5"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <a
            href="https://wa.me/8801334177275"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp - 01334 177275"
            className="text-black hover:text-[#25D366] transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="w-5 h-5"
            >
              <path d="M19.05 4.94A9.91 9.91 0 0 0 12.03 2C6.55 2 2.06 6.48 2.06 11.97c0 1.75.46 3.46 1.33 4.97L2 22l5.2-1.36a9.87 9.87 0 0 0 4.82 1.23h.01c5.48 0 9.96-4.48 9.96-9.97 0-2.67-1.04-5.17-2.94-7.06zm-7.02 15.12h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.09.81.82-3.01-.2-.31a8.26 8.26 0 0 1-1.26-4.26c0-4.57 3.72-8.29 8.3-8.29 2.21 0 4.29.86 5.85 2.43a8.23 8.23 0 0 1 2.43 5.86c0 4.57-3.72 8.3-8.36 8.3zm4.55-6.21c-.25-.12-1.47-.73-1.7-.81-.23-.09-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.55.12.17 1.73 2.65 4.2 3.71.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.17-.48-.29z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
