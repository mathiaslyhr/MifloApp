import Foundation
import React
import UIKit

extension Notification.Name {
  static let mifloApnsToken = Notification.Name("miflo.apnsToken")
  static let mifloApnsTokenError = Notification.Name("miflo.apnsTokenError")
}

/// Hands the raw APNs device token to JS. Registration is the only native-only
/// step of the push pipeline: permission prompting stays in Notifee and the
/// token upload lives in src/core/notifications/pushInvites.ts. The AppDelegate
/// callbacks relay Apple's answer here via NotificationCenter.
@objc(PushTokenModule)
class PushTokenModule: NSObject {
  private var pending: [(RCTPromiseResolveBlock, RCTPromiseRejectBlock)] = []
  private var observers: [NSObjectProtocol] = []
  private let lock = NSLock()

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(getApnsToken:rejecter:)
  func getApnsToken(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    lock.lock()
    pending.append((resolve, reject))
    let isFirst = pending.count == 1
    lock.unlock()
    // One in-flight registration serves every concurrent waiter.
    guard isFirst else { return }

    let center = NotificationCenter.default
    observers.append(center.addObserver(
      forName: .mifloApnsToken, object: nil, queue: .main
    ) { [weak self] note in
      self?.finish(token: note.object as? String, error: nil)
    })
    observers.append(center.addObserver(
      forName: .mifloApnsTokenError, object: nil, queue: .main
    ) { [weak self] note in
      self?.finish(token: nil, error: note.object as? Error)
    })

    DispatchQueue.main.async {
      UIApplication.shared.registerForRemoteNotifications()
    }
    // Apple answers within seconds when reachable; without a network there is
    // no callback at all, so cap the wait instead of leaking the promise.
    DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
      self?.finish(token: nil, error: NSError(
        domain: "Miflo", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Timed out waiting for APNs token"]
      ))
    }
  }

  private func finish(token: String?, error: Error?) {
    lock.lock()
    let waiters = pending
    pending = []
    let stale = observers
    observers = []
    lock.unlock()
    stale.forEach { NotificationCenter.default.removeObserver($0) }
    for (resolve, reject) in waiters {
      if let token {
        resolve(token)
      } else {
        reject("apns_token_failed", error?.localizedDescription ?? "Registration failed", error)
      }
    }
  }
}
