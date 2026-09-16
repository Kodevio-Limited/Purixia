'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, ChevronRight } from 'lucide-react';

const sections = [
  {
    title: '1. Information We Collect',
    content: [
      'Personal Information: When you register, place an order, or contact us, we may collect your name, email address, phone number, and delivery address.',
      'Order Information: Details of the products you purchase, transaction amounts, and payment status.',
      'Usage Data: Information about how you interact with our website, such as pages visited and products viewed, collected automatically to improve your experience.',
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      'To process and deliver your orders accurately and on time.',
      'To create and manage your Purixia BD account.',
      'To respond to your questions, complaints, or support requests.',
      'To send order updates and, with your consent, promotional offers and announcements.',
      'To detect, prevent, and address fraud or security issues.',
    ],
  },
  {
    title: '3. Data Sharing',
    content: [
      'We do not sell, trade, or rent your personal information to third parties.',
      'Delivery partners receive only the information necessary to complete your shipment (name, address, phone number).',
      'Payment processors receive only the data required to securely verify your transaction.',
      'We may disclose information if required by law, regulation, or valid legal process.',
    ],
  },
  {
    title: '4. Data Security',
    content: [
      'We use reasonable administrative and technical measures to protect your personal data, including encrypted connections (HTTPS) and restricted access to customer records.',
      'While we strive to protect your information, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    title: '5. Cookies',
    content: [
      'Our website uses cookies and similar technologies to keep you signed in, remember your cart, and understand how the site is used.',
      'You can disable cookies in your browser settings, but some parts of the site may not function correctly as a result.',
    ],
  },
  {
    title: '6. Data Retention',
    content: [
      'We retain your personal information only as long as necessary to fulfill your orders, comply with legal obligations, resolve disputes, and enforce our agreements.',
      'You may request deletion of your account and associated personal data at any time by contacting us.',
    ],
  },
  {
    title: '7. Your Rights',
    content: [
      'Access: Request a copy of the personal information we hold about you.',
      'Correction: Request that inaccurate or incomplete information be updated.',
      'Deletion: Request removal of your personal data, subject to legal retention requirements.',
      'Opt-out: Unsubscribe from marketing communications at any time.',
    ],
  },
  {
    title: '8. Children’s Privacy',
    content: [
      'Purixia BD does not knowingly collect personal information from children under 13. If you believe a child has provided us personal data, please contact us so we can delete it.',
    ],
  },
  {
    title: '9. Changes to This Policy',
    content: [
      'We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date. Continued use of the site after changes means you accept the revised policy.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white font-poppins"
    >
      {/* Page Header */}
      <div className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] pt-[40px] pb-[20px]">
        <div className="max-w-[1440px] mx-auto">
          <nav className="flex items-center gap-1 text-[11px] text-[#666666] mb-4 uppercase tracking-wider">
            <Link href="/" className="hover:text-[#F4B227] transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-black font-bold">Privacy Policy</span>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-[10px] bg-[#F4B227]/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#F4B227]" />
            </div>
            <h1 className="text-[28px] md:text-[32px] font-bold text-black tracking-tight uppercase">
              Privacy Policy
            </h1>
          </div>
          <p className="text-[13px] text-[#666666] max-w-2xl leading-relaxed">
            At Purixia BD, your privacy matters. This policy explains what information we
            collect, how we use it, and the choices you have. Built on integrity, driven by trust.
          </p>
          <p className="text-[11px] text-[#666666] mt-2">
            Last updated: September 16, 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] pb-[60px]">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
          {/* Table of Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-[100px] border border-gray-100 rounded-[20px] p-5 bg-[#FFFBEB]/40">
              <h2 className="text-[12px] font-bold text-black uppercase tracking-wider mb-3">Contents</h2>
              <ul className="space-y-2.5">
                {sections.map((section) => (
                  <li key={section.title}>
                    <a
                      href={`#${section.title.split('.')[0].toLowerCase().replace(/\s+/g, '-')}`}
                      className="text-[12px] text-[#666666] hover:text-[#F4B227] transition-colors leading-snug block"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Policy Sections */}
          <div className="max-w-3xl space-y-8">
            {sections.map((section) => (
              <section
                key={section.title}
                id={section.title.split('.')[0].toLowerCase().replace(/\s+/g, '-')}
                className="scroll-mt-[90px]"
              >
                <h2 className="text-[17px] font-bold text-black mb-3 uppercase tracking-wide">
                  {section.title}
                </h2>
                <ul className="space-y-2.5">
                  {section.content.map((paragraph, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#F4B227] shrink-0" />
                      <p className="text-[13px] text-[#666666] leading-relaxed">{paragraph}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {/* Contact notice */}
            <div className="bg-[#FFFBEB] border border-[#F4B227]/20 rounded-[20px] p-6">
              <h3 className="text-[14px] font-bold text-black mb-1">Questions about your privacy?</h3>
              <p className="text-[13px] text-[#666666] mb-3 leading-relaxed">
                Reach out to us any time — we&apos;re happy to help.
              </p>
              <Link
                href="/contact-us"
                className="inline-flex items-center gap-2 h-[40px] px-5 bg-[#F4B227] text-white font-bold text-[13px] rounded-[8px] hover:bg-[#D89500] transition-colors"
              >
                Contact Us <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
