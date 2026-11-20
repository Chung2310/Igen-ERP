import { useState } from 'react';
import {
  Calendar,
  Clock,
  Dumbbell,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { CustomerJourneyDto } from '../../types';
import WorkoutSessionDetail from '../progress/WorkoutSessionDetail';

interface CustomerSessionsProps {
  journey: CustomerJourneyDto;
}

export default function CustomerSessions({ journey }: CustomerSessionsProps) {
  const { calendar = [], sessions = [] } = journey;

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED'>('ALL');

  const now = new Date();
  const upcomingCalendar = (calendar || [])
    .filter((e) => !e.startsAt || new Date(String(e.startsAt)) >= now || true) // Show all calendar if none future
    .sort((a, b) => new Date(String(a.startsAt || 0)).getTime() - new Date(String(b.startsAt || 0)).getTime());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Top Summary Header ── */}
      <div
        style={{
          background: 'linear-gradient(90deg, #003b70 0%, #0369a1 100%)',
          borderRadius: '14px',
          padding: '16px 20px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} color="#38bdf8" />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#bae6fd', letterSpacing: '0.5px' }}>
              Quản lý lịch hẹn & nhật ký tập
            </span>
            <h2 style={{ margin: '2px 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
              Lịch Hẹn Tập & Nhật Ký Buổi Tập
            </h2>
          </div>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '4px 6px',
            borderRadius: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            style={{
              padding: '4px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeFilter === 'ALL' ? '#ffffff' : 'transparent',
              color: activeFilter === 'ALL' ? '#003b70' : 'rgba(255, 255, 255, 0.8)',
              transition: 'all 0.15s ease',
            }}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('UPCOMING')}
            style={{
              padding: '4px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeFilter === 'UPCOMING' ? '#ffffff' : 'transparent',
              color: activeFilter === 'UPCOMING' ? '#003b70' : 'rgba(255, 255, 255, 0.8)',
              transition: 'all 0.15s ease',
            }}
          >
            Lịch hẹn ({calendar.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('COMPLETED')}
            style={{
              padding: '4px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeFilter === 'COMPLETED' ? '#ffffff' : 'transparent',
              color: activeFilter === 'COMPLETED' ? '#003b70' : 'rgba(255, 255, 255, 0.8)',
              transition: 'all 0.15s ease',
            }}
          >
            Đã tập ({sessions.length})
          </button>
        </div>
      </div>

      {/* ── SECTION 1: UPCOMING CALENDAR SCHEDULE ── */}
      {(activeFilter === 'ALL' || activeFilter === 'UPCOMING') && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#003b70', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#0284c7" /> Lịch Hẹn Tập Luyện Sắp Tới
            </h3>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
              {calendar.length} lịch hẹn
            </span>
          </div>

          {calendar.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {calendar.map((event, idx) => {
                const startDate = event.startsAt ? new Date(String(event.startsAt)) : null;
                return (
                  <div
                    key={event._id || idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#0284c7',
                            border: '1px solid #bfdbfe',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          Buổi tập 1-1 với PT
                        </span>
                        {startDate && (
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                            {startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <h4 style={{ margin: '6px 0 4px', fontSize: '0.98rem', fontWeight: 800, color: '#003b70' }}>
                        {String(event.title || 'Buổi tập cùng PT')}
                      </h4>

                      {startDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                          <Clock size={13} color="#0284c7" />
                          <span>
                            {startDate.toLocaleDateString('vi-VN', {
                              weekday: 'long',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}

                      {event.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                          <MapPin size={13} color="#94a3b8" />
                          <span>{String(event.location)}</span>
                        </div>
                      )}

                      {event.notes && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#334155', background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '6px', fontStyle: 'italic' }}>
                          &ldquo;{String(event.notes)}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                Chưa có lịch hẹn tập mới. Vui lòng trao đổi với Huấn luyện viên để sắp xếp thời gian tập luyện nhé!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 2: COMPLETED WORKOUT SESSIONS (LOGS) ── */}
      {(activeFilter === 'ALL' || activeFilter === 'COMPLETED') && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#003b70', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Dumbbell size={18} color="#0284c7" /> Nhật Ký Các Buổi Đã Tập
            </h3>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
              {sessions.length} buổi hoàn thành
            </span>
          </div>

          {sessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {sessions.map((session) => (
                <WorkoutSessionDetail session={session} key={session._id} />
              ))}
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                Chưa có nhật ký buổi tập. Khi bạn hoàn thành buổi tập cùng Huấn luyện viên, các chỉ số thực tế phù hợp với từng bài sẽ được lưu tại đây!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
