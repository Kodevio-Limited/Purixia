'use client';

import * as React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full bg-[#FFFBEB] pt-[60px] pb-[30px] px-4 sm:px-6 md:px-[40px] lg:px-[80px] border-t border-gray-100">
      <div className="max-w-[1440px] mx-auto w-full grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-[40px]">
        {/* Company Info */}
        <div className="col-span-1 space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[22px] font-extrabold text-black font-poppins">
              Purixia BD
            </span>
          </Link>
          <p className="text-[13px] text-[#666666] leading-relaxed font-poppins">
            Your premier destination for high-quality gadgets and tech accessories. We provide authentic products with reliable customer support across Bangladesh.
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
              <span className="block">Phone: +880 1334-177275 (WhatsApp)</span>
              <span className="block">Phone: +880 1334-177276 (Cell)</span>
            </li>
            <li className="text-[#666666] text-[13px] font-poppins">Address: Dhaka, Bangladesh</li>
          </ul>
        </div>

        {/* Support Links */}
        <div className="col-span-1">
          <h3 className="text-[16px] font-bold text-black mb-4 font-poppins uppercase tracking-wider">Support</h3>
          <ul className="space-y-3">
            <li><span aria-disabled="true" className="text-[#666666] text-[13px] font-poppins cursor-not-allowed opacity-50">Privacy Policy</span></li>
            <li><span aria-disabled="true" className="text-[#666666] text-[13px] font-poppins cursor-not-allowed opacity-50">Terms & Condition</span></li>
            <li><span aria-disabled="true" className="text-[#666666] text-[13px] font-poppins cursor-not-allowed opacity-50">Help Center</span></li>
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
        </div>
      </div>
    </footer>
  );
}
