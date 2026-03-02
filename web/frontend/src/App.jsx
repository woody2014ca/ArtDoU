import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Index from './pages/Index';
import ParentHome from './pages/ParentHome';
import BindParent from './pages/BindParent';
import FindStudentToPay from './pages/FindStudentToPay';
import Payment from './pages/Payment';
import PaymentManage from './pages/PaymentManage';
import Checkin from './pages/Checkin';
import AddStudent from './pages/AddStudent';
import EditStudent from './pages/EditStudent';
import Enroll from './pages/Enroll';
import EnrollList from './pages/EnrollList';
import Finance from './pages/Finance';
import Poster from './pages/Poster';
import PosterView from './pages/PosterView';
import Leave from './pages/Leave';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/finance" element={<Finance />} />
      <Route path="/bind" element={<BindParent />} />
      <Route path="/pay/find" element={<FindStudentToPay />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/payment/manage" element={<PaymentManage />} />
      <Route path="/parent" element={<ParentHome />} />
      <Route path="/poster" element={<Poster />} />
      <Route path="/poster/view" element={<PosterView />} />
      <Route path="/leave" element={<Leave />} />
      <Route path="/checkin" element={<Checkin />} />
      <Route path="/student/add" element={<AddStudent />} />
      <Route path="/student/edit/:id" element={<EditStudent />} />
      <Route path="/enroll" element={<Enroll />} />
      <Route path="/enroll/list" element={<EnrollList />} />
      <Route path="/" element={<Index />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
