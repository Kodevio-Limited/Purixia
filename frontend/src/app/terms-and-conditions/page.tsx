'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, ChevronRight } from 'lucide-react';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: [
      'By accessing or using the Purixia BD website, creating an account, or placing an order, you agree to be bound by these Terms & Conditions and our Privacy Policy.',
      'If you do not agree with any part of these terms, please do not use our website or services.',
    ],
  },
  {
    title: '2. Eligibility',
    content: [
      'You must be at least 18 years of age, or use the website under the supervision of a parent or legal guardian, to make purchases on Purixia BD.',
      'You agree to provide accurate, current, and complete information when registering an account and placing orders.',
    ],
  },
  {
    title: '3. Products & Pricing',
    content: [
      'All products listed on Purixia BD are subject to availability. We reserve the right to discontinue any product or update product information at any time without notice.',
      'Prices are displayed in Bangladeshi Taka (৳) and may change without prior notice. While we work hard to ensure accuracy, pricing or specification errors may occasionally occur, and we reserve the right to correct them before dispatch.',
      'Promotional discounts and offers cannot be combined unless explicitly stated.',
    ],
  },
  {
    title: '4. Orders & Acceptance',
    content: [
      'Your order is an offer to buy. An order is accepted only when we confirm it via phone, email, or WhatsApp. We may decline or cancel any order at our discretion, including reasons such as stock unavailability, pricing errors, or suspicion of fraud.',
      'If a prepaid order is cancelled by us, the full amount will be refunded to your original payment method.',
    ],
  },
  {
    title: '5. Payment',
    content: [
      'We accept Cash on Delivery (COD) and other payment methods shown at checkout.',
      'Cash on Delivery orders must be paid in full in Bangladeshi Taka at the time of receiving the parcel.',
    ],
  },
  {
    title: '6. Delivery',
    content: [
      'We deliver across Bangladesh. Estimated delivery times are provided at checkout and may vary due to location, weather, courier delays, or other circumstances beyond our control.',
      'Delivery charges (if any) are displayed before you confirm your order. Additional remote-area charges may apply for certain locations.',
      'Risk of loss passes to you upon delivery of the product to the address you provided.',
    ],
  },
  {
    title: '7. Returns, Replacements & Refunds',
    content: [
      'Products with manufacturing defects or damaged-in-transit items are eligible for replacement. Please record an unboxing video and contact us within 24–48 hours of delivery with your order number.',
      'To be eligible for a return, the product must be unused, in its original packaging, and with all accessories included.',
      'Refunds, when approved, are processed to your original payment method or via mobile banking within a reasonable number of business days.',
      'The following are non-returnable: products damaged due to misuse, products without original packaging, and items explicitly marked as non-returnable.',
    ],
  },
  {
    title: '8. Warranty',
    content: [
      'Warranty coverage (if any) for a product is provided by the brand or manufacturer, not Purixia BD, unless stated otherwise on the product page.',
      'Warranty claims require the original invoice and may require the product to be sent to the manufacturer’s service center.',
    ],
  },
  {
    title: '9. Account Responsibilities',
    content: [
      'You are responsible for keeping your account credentials confidential and for all activity that occurs under your account.',
      'We reserve the right to suspend or terminate accounts that engage in fraudulent activity, abuse returns, or violate these terms.',
    ],
  },
  {
    title: '10. Intellectual Property',
    content: [
      'All content on this website — including the Purixia BD name, logo, product images, and descriptions — is the property of Purixia BD or its licensors and may not be copied or used without permission.',
    ],
  },
  {
    title: '11. Limitation of Liability',
    content: [
      'To the maximum extent permitted by law, Purixia BD shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or products.',
      'Our total liability for any claim shall not exceed the amount you paid for the product giving rise to the claim.',
    ],
  },
  {
    title: '12. Governing Law',
    content: [
      'These terms are governed by the laws of the People’s Republic of Bangladesh. Any dispute arising from these terms shall be subject to the exclusive jurisdiction of the courts of Dhaka, Bangladesh.',
    ],
  },
  {
    title: '13. Changes to These Terms',
    content: [
      'We may revise these Terms & Conditions at any time. Changes take effect when posted on this page. Your continued use of the website after changes are posted constitutes acceptance of the revised terms.',
    ],
  },
];

export default function TermsPage() {
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
            <span className="text-black font-bold">Terms & Condition</span>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-[10px] bg-[#F4B227]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#F4B227]" />
            </div>
            <h1 className="text-[28px] md:text-[32px] font-bold text-black tracking-tight uppercase">
              Terms & Condition
            </h1>
          </div>
          <p className="text-[13px] text-[#666666] max-w-2xl leading-relaxed">
            Please read these terms carefully before using Purixia BD or placing an order.
            They form the agreement between you and Purixia BD.
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

          {/* Terms Sections */}
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
              <h3 className="text-[14px] font-bold text-black mb-1">Have a question about these terms?</h3>
              <p className="text-[13px] text-[#666666] mb-3 leading-relaxed">
                Our team is here to clarify anything before you order.
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
