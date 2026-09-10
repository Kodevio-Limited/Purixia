'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Search,
  LogOut,
  Package,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useCategories } from '../../hooks/useCategories';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';

export function Navbar() {
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useAuth();
  const { count, toggleDrawer } = useCart();
  const { data: categories } = useCategories();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = React.useState(false);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 10);
  });

  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
    toast.success('See you soon!');
  };

  return (
    <div className="w-full">
      {/* Top Navbar */}
      <header className="w-full h-[64px] bg-[#000000] flex items-center shadow-[0px_0px_4px_rgba(0,0,0,0.25)] sticky top-0 z-[100]">
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] flex items-center justify-between relative">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/logo1.png" alt="Purixia BD" width={80} height={24} className="object-contain" priority />
          </Link>

          {/* Search Bar - Desktop */}
          <div className="relative w-[440px] h-[36px] hidden md:flex items-center">
            <input
              type="text"
              placeholder="Search product..."
              className="w-full h-full bg-[#1A1A1A] border border-[#F4B227]/30 rounded-[30px] px-[16px] text-white text-[13px] font-poppins focus:outline-none focus:border-[#F4B227] transition-all"
            />
            <button aria-label="Search" className="absolute right-0 top-0 w-[50px] h-[36px] bg-[#F4B227] border border-[#F4B227] rounded-r-[30px] flex items-center justify-center hover:bg-[#D89500] transition-colors">
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Search Icon - Mobile */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
            className="md:hidden w-[36px] h-[36px] border border-[#F4B227] rounded-[18px] flex items-center justify-center text-[#F4B227] hover:bg-[#F4B227]/10 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Actions */}
          <div className="flex items-center gap-[12px]">
            {/* Profile */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Account"
                className="w-[36px] h-[36px] border border-[#F4B227] rounded-[18px] flex items-center justify-center text-[#F4B227] hover:bg-[#F4B227]/10 transition-colors"
              >
                <User className="w-5 h-5" />
              </button>
              {profileOpen && isLoggedIn && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50"
                >
                  <div className="px-4 py-2 border-b border-gray-50">
                    <p className="text-xs font-semibold text-gray-900 truncate font-poppins">{user?.username}</p>
                    <p className="text-[10px] text-gray-500 truncate font-poppins">{user?.email}</p>
                  </div>
                  <Link
                    href="/orders"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-poppins"
                  >
                    <Package className="w-3.5 h-3.5" />
                    My Orders
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors font-poppins"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </motion.div>
              )}
              {profileOpen && !isLoggedIn && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50"
                >
                  <Link
                    href="/login"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 font-poppins"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 font-poppins"
                  >
                    Register
                  </Link>
                </motion.div>
              )}
            </div>

            {/* Cart */}
            <button
              onClick={toggleDrawer}
              aria-label="Shopping cart"
              className="relative w-[36px] h-[36px] border border-[#F4B227] rounded-[18px] flex items-center justify-center text-[#F4B227] hover:bg-[#F4B227]/10 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F4B227] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Search Panel */}
      {searchOpen && (
        <div className="md:hidden bg-[#000000] px-4 pb-3 pt-0">
          <div className="relative w-full h-[36px] flex items-center">
            <input
              type="text"
              placeholder="Search product..."
              className="w-full h-full bg-[#1A1A1A] border border-[#F4B227]/30 rounded-[30px] px-[16px] text-white text-[13px] font-poppins focus:outline-none focus:border-[#F4B227] transition-all"
            />
            <button aria-label="Search" className="absolute right-0 top-0 w-[50px] h-[36px] bg-[#F4B227] border border-[#F4B227] rounded-r-[30px] flex items-center justify-center hover:bg-[#D89500] transition-colors">
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navbar */}
      <nav className="w-full h-[40px] bg-[#F5F5F5] flex items-center relative border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] flex items-center shrink-0">
          {/* Categories Button + Dropdown: hover is handled on the wrapper so moving from the button into the panel keeps it open */}
          <div
            className="relative shrink-0"
            onMouseEnter={() => setIsCategoriesOpen(true)}
            onMouseLeave={() => setIsCategoriesOpen(false)}
          >
            <button
              aria-expanded={isCategoriesOpen}
              aria-label="Categories"
              className="w-[140px] md:w-[180px] h-[40px] bg-[#F4B227] rounded-t-[5px] flex items-center px-[12px] gap-[8px] text-white font-bold text-[12px] md:text-[14px] font-poppins"
            >
              Categories
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isCategoriesOpen && "rotate-180")} />
            </button>

            {/* Categories Dropdown */}
            {isCategoriesOpen && (
              <div className="absolute left-0 top-full w-[200px] bg-white rounded-b-[5px] shadow-lg z-[100]">
                {categories && categories.length > 0 ? (
                  categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/products?category=${cat.slug}`}
                      className="flex items-center h-[42px] px-[12px] border-b border-[#E5E5E5] last:border-0 text-[#2A2A2A] hover:text-[#F4B227] transition-colors font-poppins text-sm"
                    >
                      {cat.name}
                    </Link>
                  ))
                ) : (
                  <div className="px-[12px] py-3 text-[12px] text-[#666666]">No categories found</div>
                )}
              </div>
            )}
          </div>

          {/* Main Links */}
          <div className="ml-3 md:ml-[24px] flex items-center gap-1 md:gap-[8px]">
            <Link
              href="/"
              className={cn(
                "px-3 md:px-4 py-1.5 rounded text-[13px] md:text-[15px] font-medium font-poppins whitespace-nowrap transition-colors",
                pathname === "/" ? "text-[#F4B227]" : "text-[#2A2A2A] hover:text-[#F4B227]"
              )}
            >
              Home
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}
