#import <React/RCTBridgeModule.h>

// Exposes the Swift PushTokenModule (see PushTokenModule.swift) to JS as
// NativeModules.PushTokenModule via the new-arch interop layer.
@interface RCT_EXTERN_MODULE(PushTokenModule, NSObject)

RCT_EXTERN_METHOD(getApnsToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
