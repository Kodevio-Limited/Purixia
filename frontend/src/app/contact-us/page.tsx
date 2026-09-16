'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Truck,
} from 'lucide-react';

const contactInfo = [
  {
    icon: Mail,
    label: 'Email Us',
    value: 'purixiabd@gmail.com',
    href: 'mailto:purixiabd@gmail.com',
  },
  {
    icon: Phone,
    label: 'Call / WhatsApp',
    value: '+880 1334-177276',
    href: 'tel:+8801334177276',
  },
  {
    icon: MapPin,
    label: 'Visit Us',
    value: 'Dhaka, Bangladesh',
  },
  {
    icon: Clock,
    label: 'Support Hours',
    value: 'Sat – Thu, 10:00 AM – 8:00 PM',
  },
];

const infoCards = [
  {
    icon: Truck,
    title: 'Order & Delivery',
    text: 'Questions about an order, delivery time, or charges? Have your order number ready and we’ll help you right away.',
  },
  {
    icon: ShieldCheck,
    title: 'Returns & Warranty',
    text: 'For defective or damaged products, contact us within 24–48 hours of delivery with an unboxing video for a quick replacement.',
  },
  {
    icon: MessageCircle,
    title: 'General Inquiries',
    text: 'For partnerships, bulk orders, or any other questions, email us or send a message through the form — we reply fast.',
  },
];

interface FormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactUsPage() {
  const [values, setValues] = React.useState<FormValues>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = React.useState<Partial<FormValues>>({});

  const validate = (): boolean => {
    const next: Partial<FormValues> = {};
    if (!values.name.trim()) next.name = 'Please enter your name';
    if (!values.email.trim()) next.email = 'Please enter your email';
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = 'Invalid email address';
    if (!values.subject.trim()) next.subject = 'Please enter a subject';
    if (values.message.trim().length < 10) next.message = 'Message must be at least 10 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    const body = [
      `Name: ${values.name}`,
      `Email: ${values.email}`,
      '',
      values.message,
    ].join('\n');

    const mailtoUrl = `mailto:purixiabd@gmail.com?subject=${encodeURIComponent(
      values.subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
    toast.success('Opening your email app to send the message...');
  };

  const handleChange =
    (field: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const inputClass = (hasError?: string) =>
    `w-full h-[44px] px-4 bg-white border rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors ${
      hasError ? 'border-red-400' : 'border-gray-100'
    }`;

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
            <span className="text-black font-bold">Contact Us</span>
          </nav>

          <h1 className="text-[28px] md:text-[32px] font-bold text-black tracking-tight uppercase">
            Contact Us
          </h1>
          <p className="text-[13px] text-[#666666] max-w-2xl leading-relaxed mt-2">
            We&apos;re here to help with orders, delivery, returns, or anything else.
            Reach out through any channel below — we usually reply within a few hours.
          </p>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] pb-[20px]">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]">
          {contactInfo.map((item) => {
            const Icon = item.icon;
            const inner = (
              <>
                <div className="w-11 h-11 rounded-[10px] bg-[#F4B227]/10 flex items-center justify-center mb-4 group-hover:bg-[#F4B227] transition-colors">
                  <Icon className="w-5 h-5 text-[#F4B227] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-[13px] font-bold text-black uppercase tracking-wide mb-1">
                  {item.label}
                </h3>
                <p className="text-[13px] text-[#666666] leading-relaxed">{item.value}</p>
              </>
            );

            return item.href ? (
              <a
                key={item.label}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="group bg-white rounded-[20px] border border-gray-100 p-6 shadow-[0px_4px_15px_rgba(0,0,0,0.03)] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all"
              >
                {inner}
              </a>
            ) : (
              <div
                key={item.label}
                className="group bg-white rounded-[20px] border border-gray-100 p-6 shadow-[0px_4px_15px_rgba(0,0,0,0.03)]"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form + Help Topics */}
      <div className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] pb-[60px]">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[40px]">
          {/* Contact Form */}
          <div className="bg-white rounded-[20px] border border-gray-100 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] p-6 md:p-8">
            <h2 className="text-[18px] font-bold text-black uppercase tracking-wide mb-1">
              Send us a message
            </h2>
            <p className="text-[12px] text-[#666666] mb-6">
              Fill out the form and your email app will open with the message ready to send.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-black">Your Name</label>
                  <input
                    type="text"
                    value={values.name}
                    onChange={handleChange('name')}
                    placeholder="Enter your name"
                    className={inputClass(errors.name)}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-black">Email Address</label>
                  <input
                    type="email"
                    value={values.email}
                    onChange={handleChange('email')}
                    placeholder="Enter your email"
                    className={inputClass(errors.email)}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-black">Subject</label>
                <input
                  type="text"
                  value={values.subject}
                  onChange={handleChange('subject')}
                  placeholder="What is this about? (e.g. Order #12 delivery)"
                  className={inputClass(errors.subject)}
                />
                {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-black">Message</label>
                <textarea
                  value={values.message}
                  onChange={handleChange('message')}
                  placeholder="Write your message here..."
                  rows={6}
                  className={`w-full px-4 py-3 bg-white border rounded-[8px] text-[13px] focus:outline-none focus:border-[#F4B227] transition-colors resize-none ${
                    errors.message ? 'border-red-400' : 'border-gray-100'
                  }`}
                />
                {errors.message && <p className="text-xs text-red-500">{errors.message}</p>}
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 h-[48px] px-8 bg-[#F4B227] text-white font-bold text-[14px] rounded-[8px] hover:bg-[#D89500] transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </form>
          </div>

          {/* Help Topics */}
          <div className="space-y-5">
            <h2 className="text-[18px] font-bold text-black uppercase tracking-wide">
              How can we help?
            </h2>
            {infoCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-white rounded-[20px] border border-gray-100 p-5 shadow-[0px_4px_15px_rgba(0,0,0,0.03)] flex gap-4"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-[#F4B227]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#F4B227]" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-black mb-1">{card.title}</h3>
                    <p className="text-[12px] text-[#666666] leading-relaxed">{card.text}</p>
                  </div>
                </div>
              );
            })}

            <div className="bg-[#FFFBEB] border border-[#F4B227]/20 rounded-[20px] p-5">
              <h3 className="text-[13px] font-bold text-black mb-1">Prefer social?</h3>
              <p className="text-[12px] text-[#666666] leading-relaxed">
                Message us on WhatsApp or reach us through our Facebook page — links are in the
                footer below.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
