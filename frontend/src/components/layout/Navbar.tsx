'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  User,
  Search,
  LogOut,
  Package,
  ChevronDown,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useCategories } from '../../hooks/useCategories';
import toast from 'react-hot-toast';

export function Navbar() {
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useAuth();
  const { count, toggleDrawer } = useCart();
  const { data: categories } = useCategories();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [expandedCatId, setExpandedCatId] = React.useState<number | null>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = React.useState(false);
  const [hoveredCatId, setHoveredCatId] = React.useState<number | null>(null);

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

  // Close the mobile menu on navigation, and collapse open categories when it closes
  const toggleMobileMenu = () => {
    setMobileMenuOpen((open) => !open);
    setExpandedCatId(null);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setExpandedCatId(null);
  };

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
    toast.success('See you soon!');
  };

  return (
    <div className="w-full">
      {/* Top Navbar */}
      <header className="w-full bg-navy shadow-[0px_0px_4px_rgba(0,0,0,0.25)] sticky top-0 z-[100]">
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] flex items-center justify-between relative h-[64px]">
          {/* Mobile menu + Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleMobileMenu}
              aria-label="Browse categories"
              aria-expanded={mobileMenuOpen}
              className="md:hidden w-[36px] h-[36px] border border-orange rounded-[18px] flex items-center justify-center text-orange hover:bg-orange/10 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 shrink-0">
              {/* Dark-background logo variant: orange symbol + white wordmark */}
              <Image src="/brand-logo-dark.png" alt="Purixia BD" width={132} height={26} className="object-contain" priority />
            </Link>
          </div>

          {/* Search Bar - Desktop */}
          <div className="relative w-[440px] h-[36px] hidden md:flex items-center">
            <input
              type="text"
              placeholder="Search product..."
              className="w-full h-full bg-navy-700 border border-orange/30 rounded-[30px] px-[16px] text-white text-[13px] font-poppins focus:outline-none focus:border-orange transition-all"
            />
            <button aria-label="Search" className="absolute right-0 top-0 w-[50px] h-[36px] bg-orange border border-orange rounded-r-[30px] flex items-center justify-center hover:bg-orange-700 transition-colors">
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-[12px]">
            {/* Profile */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Account"
                className="w-[36px] h-[36px] border border-orange rounded-[18px] flex items-center justify-center text-orange hover:bg-orange/10 transition-colors"
              >
                <User className="w-5 h-5" />
              </button>
              {profileOpen && isLoggedIn && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-52 bg-white border border-neutral-100 rounded-2xl shadow-xl py-2 z-50"
                >
                  <div className="px-4 py-2 border-b border-neutral-100">
                    <p className="text-xs font-semibold text-navy truncate font-poppins">{user?.username}</p>
                    <p className="text-[10px] text-neutral-500 truncate font-poppins">{user?.email}</p>
                  </div>
                  <Link
                    href="/orders"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-neutral-700 hover:bg-surface transition-colors font-poppins"
                  >
                    <Package className="w-3.5 h-3.5" />
                    My Orders
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-error hover:bg-error-50 transition-colors font-poppins"
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
                  className="absolute right-0 mt-2 w-40 bg-white border border-neutral-100 rounded-2xl shadow-xl py-2 z-50"
                >
                  <Link
                    href="/login"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2.5 text-xs text-neutral-700 hover:bg-surface font-poppins"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2.5 text-xs text-neutral-700 hover:bg-surface font-poppins"
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
              className="relative w-[36px] h-[36px] border border-orange rounded-[18px] flex items-center justify-center text-orange hover:bg-orange/10 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search bar — always visible */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative w-full h-[36px] flex items-center">
            <input
              type="text"
              placeholder="Search product..."
              className="w-full h-full bg-navy-700 border border-orange/30 rounded-[30px] px-[16px] text-white text-[13px] font-poppins focus:outline-none focus:border-orange transition-all"
            />
            <button aria-label="Search" className="absolute right-0 top-0 w-[50px] h-[36px] bg-orange border border-orange rounded-r-[30px] flex items-center justify-center hover:bg-orange-700 transition-colors">
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Mobile three-dot menu — categories + subcategories */}
        {mobileMenuOpen && (
          <>
            <button
              aria-label="Close menu"
              onClick={closeMobileMenu}
              className="md:hidden fixed inset-0 z-0 bg-black/20"
            />
            <div className="md:hidden absolute left-0 right-0 top-full z-10 bg-white border-t border-neutral-100 shadow-xl max-h-[70vh] overflow-y-auto">
              {categories && categories.length > 0 ? (
                categories.map((cat) => {
                  const hasSubs = cat.subcategories && cat.subcategories.length > 0;
                  const isExpanded = expandedCatId === cat.id;
                  return (
                    <div key={cat.id} className="border-b border-neutral-100 last:border-0">
                      {hasSubs ? (
                        <button
                          onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                          aria-expanded={isExpanded}
                          className="w-full flex items-center justify-between px-4 h-[46px] text-sm font-medium text-navy font-poppins"
                        >
                          {cat.name}
                          <ChevronDown className={cn('w-4 h-4 text-neutral-400 transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                      ) : (
                        <Link
                          href={`/products?category=${cat.slug}`}
                          onClick={closeMobileMenu}
                          className="w-full flex items-center justify-between px-4 h-[46px] text-sm font-medium text-navy font-poppins"
                        >
                          {cat.name}
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </Link>
                      )}
                      {hasSubs && isExpanded && (
                        <div className="pb-2 bg-surface/70">
                          <Link
                            href={`/products?category=${cat.slug}`}
                            onClick={closeMobileMenu}
                            className="block px-8 py-2 text-[11px] font-bold uppercase tracking-wider text-orange"
                          >
                            All {cat.name}
                          </Link>
                          {cat.subcategories!.map((sub) => (
                            <Link
                              key={sub.id}
                              href={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                              onClick={closeMobileMenu}
                              className="block px-8 py-2 text-xs text-neutral-700 font-poppins"
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-[12px] text-neutral-500">No categories found</div>
              )}
            </div>
          </>
        )}
      </header>

      {/* Bottom Navbar */}
      <nav className="w-full h-[40px] bg-surface flex items-center relative border-b border-neutral-100">
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] flex items-center shrink-0">
          {/* Categories Button + Dropdown: hover is handled on the wrapper so moving from the button into the panel keeps it open */}
          <div
            className="relative shrink-0"
            onMouseEnter={() => setIsCategoriesOpen(true)}
            onMouseLeave={() => {
              setIsCategoriesOpen(false);
              setHoveredCatId(null);
            }}
          >
            <button
              onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
              aria-expanded={isCategoriesOpen}
              aria-label="Categories"
              className="w-[140px] md:w-[180px] h-[40px] bg-orange rounded-t-[5px] flex items-center px-[12px] gap-[8px] text-white font-bold text-[12px] md:text-[14px] font-poppins"
            >
              Categories
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isCategoriesOpen && "rotate-180")} />
            </button>

            {/* Categories Dropdown */}
            {isCategoriesOpen && (
              <div className="absolute left-0 top-full flex z-[100]">
                {/* Main Category List */}
                <div className="w-[220px] bg-white rounded-b-[5px] shadow-xl border border-neutral-100 py-1 max-h-[380px] overflow-y-auto">
                  {categories && categories.length > 0 ? (
                    categories.map((cat) => {
                      const hasSubs = cat.subcategories && cat.subcategories.length > 0;
                      const isHovered = hoveredCatId === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onMouseEnter={() => setHoveredCatId(cat.id)}
                          className={cn(
                            "flex items-center justify-between px-3 h-[42px] transition-colors font-poppins text-sm border-b border-neutral-100 last:border-0",
                            isHovered ? "bg-surface text-orange font-medium" : "text-navy hover:text-orange"
                          )}
                        >
                          <Link
                            href={`/products?category=${cat.slug}`}
                            onClick={() => {
                              setIsCategoriesOpen(false);
                              setHoveredCatId(null);
                            }}
                            className="flex-1 truncate"
                          >
                            {cat.name}
                          </Link>
                          {hasSubs && (
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-1" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-[12px] py-3 text-[12px] text-neutral-500">No categories found</div>
                  )}
                </div>

                {/* Subcategories Flyout Panel */}
                {hoveredCatId && (() => {
                  const activeCat = categories?.find((c) => c.id === hoveredCatId);
                  if (!activeCat || !activeCat.subcategories || activeCat.subcategories.length === 0) return null;
                  return (
                    <div
                      className="w-[220px] bg-white rounded-[5px] shadow-xl border border-neutral-100 p-2 ml-1 max-h-[380px] overflow-y-auto animate-in fade-in slide-in-from-left-2 duration-150"
                      onMouseEnter={() => setHoveredCatId(activeCat.id)}
                    >
                      <div className="px-2 py-1.5 border-b border-neutral-100 mb-1">
                        <Link
                          href={`/products?category=${activeCat.slug}`}
                          onClick={() => {
                            setIsCategoriesOpen(false);
                            setHoveredCatId(null);
                          }}
                          className="text-xs font-bold text-orange uppercase tracking-wider hover:underline"
                        >
                          All {activeCat.name}
                        </Link>
                      </div>
                      {activeCat.subcategories.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/products?category=${activeCat.slug}&subcategory=${sub.slug}`}
                          onClick={() => {
                            setIsCategoriesOpen(false);
                            setHoveredCatId(null);
                          }}
                          className="block px-2 py-1.5 rounded text-xs text-neutral-700 hover:bg-surface hover:text-orange transition-colors font-poppins"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Main Links */}
          <div className="ml-3 md:ml-[24px] flex items-center gap-1 md:gap-[8px]">
            <Link
              href="/"
              className={cn(
                "px-3 md:px-4 py-1.5 rounded text-[13px] md:text-[15px] font-medium font-poppins whitespace-nowrap transition-colors",
                pathname === "/" ? "text-orange" : "text-navy hover:text-orange"
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
