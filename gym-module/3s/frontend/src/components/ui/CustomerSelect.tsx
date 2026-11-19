import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Check, ChevronDown, Loader2, Phone, Search, User, X } from 'lucide-react';
import { api } from '../../services/api';
import type { Customer } from '../../types';

export interface CustomerSelectProps {
  label?: string;
  name?: string;
  value?: string | any;
  onChange: (customerId: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  ariaLabel?: string;
  customers?: Customer[];
  extraCustomer?: Customer | null;
  onSelectCustomer?: (customer: Customer | null) => void;
}

export default function CustomerSelect({
  label = 'Học viên / Khách hàng',
  name = 'customerId',
  value = '',
  onChange,
  required = false,
  placeholder = 'Chọn hoặc tìm học viên...',
  error,
  disabled = false,
  readOnly = false,
  className = '',
  ariaLabel,
  customers: initialCustomers,
  extraCustomer,
  onSelectCustomer,
}: CustomerSelectProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers || []);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hasLoaded, setHasLoaded] = useState(Boolean(initialCustomers && initialCustomers.length > 0));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const stringValue = typeof value === 'object' && value !== null
    ? String((value as { _id?: string; id?: string })._id || (value as { _id?: string; id?: string }).id || '')
    : typeof value === 'string' ? value : '';

  // Sync initialCustomers if provided
  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0) {
      setCustomers(initialCustomers);
      setHasLoaded(true);
    }
  }, [initialCustomers]);

  // Sync extraCustomer if provided
  useEffect(() => {
    if (extraCustomer) {
      setCustomers((prev) => {
        const id = extraCustomer._id || extraCustomer.id;
        if (!id || prev.some((c) => (c._id || c.id) === id)) return prev;
        return [extraCustomer, ...prev];
      });
    }
  }, [extraCustomer]);

  // Load customers from API automatically on mount or when opened
  useEffect(() => {
    if (hasLoaded || disabled || readOnly) return;
    let active = true;
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const result = await api.get<Customer[]>('/api/customers?limit=100');
        if (active && result.data) {
          setCustomers(result.data);
          setHasLoaded(true);
        }
      } catch {
        // Fallback silently
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchCustomers();
    return () => {
      active = false;
    };
  }, [hasLoaded, disabled, readOnly]);

  // Fetch individual customer if stringValue is provided but not in list
  useEffect(() => {
    if (!stringValue || disabled || readOnly) return;
    const exists = customers.some((c) => c._id === stringValue || c.id === stringValue);
    if (exists) return;

    let active = true;
    const fetchSingleCustomer = async () => {
      try {
        const res = await api.get<Customer>(`/api/customers/${stringValue}`);
        if (active && res.data) {
          setCustomers((prev) => {
            const alreadyIn = prev.some((c) => c._id === res.data._id || c.id === res.data._id);
            return alreadyIn ? prev : [res.data, ...prev];
          });
        }
      } catch {
        // Ignore fallback
      }
    };
    void fetchSingleCustomer();
    return () => {
      active = false;
    };
  }, [stringValue, customers, disabled, readOnly]);

  // Selected customer object
  const selectedCustomer = useMemo(
    () => {
      if (typeof value === 'object' && value !== null && ('fullName' in value || '_id' in value)) {
        return value as Customer;
      }
      return customers.find((c) => String(c._id) === String(stringValue) || String(c.id) === String(stringValue));
    },
    [customers, value, stringValue]
  );

  // Filtered customers based on search text (Name, Phone, Email)
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const keyword = search.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(keyword) ||
        c.phone?.toLowerCase().includes(keyword) ||
        c.email?.toLowerCase().includes(keyword)
    );
  }, [customers, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSelect = (customer: Customer) => {
    onChange(customer._id || customer.id || '');
    onSelectCustomer?.(customer);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    onSelectCustomer?.(null);
    setSearch('');
  };

  const effectiveAriaLabel = ariaLabel || label || 'Học viên / Khách hàng';

  return (
    <div
      className={`field customer-select-container ${className}`}
      ref={wrapperRef}
      style={{
        position: 'relative',
        zIndex: open ? 50 : undefined,
      }}
    >
      {label && (
        <label htmlFor={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span>
            {label} {required && <strong className="text-danger" style={{ color: '#e11d48' }}>*</strong>}
          </span>
          {selectedCustomer && (
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
              Mã: {selectedCustomer._id?.slice(-6)}
            </span>
          )}
        </label>
      )}

      {/* Accessible Input */}
      <input
        type="text"
        id={name}
        name={name}
        aria-label={effectiveAriaLabel}
        value={stringValue}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          height: '1px',
          width: '1px',
          padding: 0,
          margin: 0,
          border: 'none',
        }}
      />

      {/* Main Trigger Button / View */}
      <div
        className={`customer-select-trigger ${error ? 'has-error' : ''} ${disabled || readOnly ? 'is-disabled' : ''}`}
        onClick={() => !disabled && !readOnly && setOpen((prev) => !prev)}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled || readOnly ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && !disabled && !readOnly) {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '44px',
          padding: '8px 12px',
          background: disabled ? '#f1f5f9' : '#ffffff',
          border: error ? '1.5px solid #e11d48' : open ? '1.5px solid #003b70' : '1px solid #cbd5e1',
          borderRadius: '10px',
          cursor: disabled || readOnly ? 'default' : 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(0, 59, 112, 0.12)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        {selectedCustomer ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: '#e0f2fe',
                color: '#0369a1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}
            >
              {selectedCustomer.fullName ? selectedCustomer.fullName.charAt(0).toUpperCase() : <User size={14} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedCustomer.fullName}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={11} style={{ color: '#0284c7' }} />
                <span>{selectedCustomer.phone || 'Chưa có SĐT'}</span>
              </span>
            </div>
            {!disabled && !readOnly && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Xóa chọn khách hàng"
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  marginLeft: 'auto',
                }}
                title="Bỏ chọn học viên"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ) : stringValue ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '0.86rem', flex: 1 }}>
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" style={{ color: '#0284c7' }} />
                <span style={{ color: '#64748b', fontStyle: 'italic' }}>Đang tải học viên...</span>
              </>
            ) : (
              <>
                <User size={15} style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 600 }}>Học viên #{stringValue.slice(-6)}</span>
              </>
            )}
            {!disabled && !readOnly && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Xóa chọn khách hàng"
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  marginLeft: 'auto',
                }}
                title="Bỏ chọn học viên"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.86rem' }}>
            <Search size={15} style={{ color: '#94a3b8' }} />
            <span>{placeholder}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px', color: '#64748b' }}>
          {loading ? (
            <Loader2 size={16} className="animate-spin" style={{ color: '#0284c7' }} />
          ) : (
            <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          )}
        </div>
      </div>

      {/* Dropdown Menu with Live Search */}
      {open && (
        <div
          className="customer-select-dropdown"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            zIndex: 9999,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            maxHeight: 'min(320px, 60vh)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Box */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={15} style={{ color: '#64748b', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              className="customer-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nhập tên, số điện thoại để lọc danh sách..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '0.84rem',
                padding: '4px 0',
                color: '#0f172a',
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* List of Customers */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                {loading ? 'Đang tải danh sách học viên...' : search ? 'Không tìm thấy học viên phù hợp.' : 'Chưa có học viên nào trong danh sách.'}
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c._id === value || c.id === value;
                return (
                  <div
                    key={c._id || c.id}
                    onClick={() => handleSelect(c)}
                    role="option"
                    aria-selected={isSelected}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f9ff' : 'transparent',
                      transition: 'background 0.12s ease',
                      marginBottom: '2px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isSelected ? '#bae6fd' : '#e2e8f0',
                          color: isSelected ? '#0369a1' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          flexShrink: 0,
                        }}
                      >
                        {c.fullName ? c.fullName.charAt(0).toUpperCase() : <User size={15} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? '#0369a1' : '#1e293b', fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.fullName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.74rem', color: '#64748b' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Phone size={11} style={{ color: '#0284c7' }} />
                            <span>{c.phone || 'Chưa có SĐT'}</span>
                          </span>
                          {c.initialGoal && (
                            <span style={{ color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              • {c.initialGoal}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{ color: '#0284c7', marginLeft: '8px', flexShrink: 0 }}>
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <small className="field-error" style={{ color: '#e11d48', marginTop: '4px', display: 'block', fontSize: '0.75rem' }}>{error}</small>}
    </div>
  );
}
